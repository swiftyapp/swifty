//! SQLite + SQLCipher backend for [`VaultStore`]. A single `Mutex<Connection>`
//! guards a WAL-mode, whole-file-encrypted database. No pool, no async, no ORM.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension, Row, Statement};
use rusqlite_migration::{Migrations, M};

use super::hash::{record_hash, state_digest};
use super::{now_ms, EntryMeta, Record, Result, StoreError, VaultStore};

// Ordered schema migrations, versioned via SQLite's `user_version` pragma. This
// is the DDL history — append (never edit) an `M::up` for each future schema
// change (Phase 2 KDF columns, Phase 3 sync columns). The `meta` k/v table holds
// APP data (KDF descriptor, biometric flag, settings), not schema versioning.
fn migrations() -> Migrations<'static> {
    Migrations::new(migration_list())
}

// After running all migrations, `user_version` equals the list length. A DB
// above that was written by a newer build — refuse with a dedicated error
// instead of letting the failure masquerade as a wrong key (see `open`).
fn schema_version() -> i64 {
    migration_list().len() as i64
}

fn migration_list() -> Vec<M<'static>> {
    vec![
        M::up(
            "CREATE TABLE meta (
           key   TEXT PRIMARY KEY,
           value TEXT
         );
         CREATE TABLE entries (
           id         TEXT PRIMARY KEY,
           kind       TEXT,
           title      TEXT,
           tags       TEXT,
           url_host   TEXT,
           created_at INTEGER,
           updated_at INTEGER,
           deleted_at INTEGER,
           payload    BLOB
         );",
        ),
        // Card network slug ("visa", …), derived from the number at save time
        // so listings show brand marks without touching the payload. NULL =
        // not yet derived (backfilled once on unlock).
        M::up("ALTER TABLE entries ADD COLUMN card_brand TEXT;"),
        // The user's star. Pre-existing rows default to unstarred, which is the
        // truth for every vault written before this column existed.
        M::up("ALTER TABLE entries ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;"),
    ]
}

// New columns are appended last so pre-existing column indexes stay put.
const COLS: &str = "id, kind, title, tags, url_host, created_at, updated_at, deleted_at, payload, card_brand, favorite";
const META_COLS: &str =
    "id, kind, title, tags, url_host, created_at, updated_at, deleted_at, card_brand, favorite";

const META_UPSERT: &str = "INSERT INTO meta (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value";

/// Namespace for every device-local sync bookkeeping key in `meta` (the dirty
/// flag, and the last-sync state the engine records). Grouped under one prefix
/// so a restore can scrub the lot without enumerating them — a snapshot carries
/// the *source* device's bookkeeping, which is meaningless on the target.
pub const SYNC_META_PREFIX: &str = "sync_";

pub struct SqliteStore {
    conn: Mutex<Connection>,
}

impl SqliteStore {
    /// Open (creating if absent) an encrypted DB at `path`, keyed by the raw
    /// `key` bytes. The key is used directly (no passphrase KDF); the caller
    /// derives it. Opening an existing DB with the wrong key fails here.
    pub fn open(path: &Path, key: &[u8]) -> Result<Self> {
        let existed = path.metadata().map(|m| m.len() > 0).unwrap_or(false);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
            set_mode(parent, 0o700);
        }

        let mut conn = Connection::open(path)?;
        // Raw-key pragma: the hex bytes are the key, not a passphrase. Must run
        // before any other pragma that touches the (encrypted) file.
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex(key)))?;
        // Connection hygiene: WAL for crash-safe per-row writes; NORMAL is the
        // durable/fast pairing for WAL; temp_store=MEMORY keeps sort/temp data
        // (plaintext metadata) off disk; busy_timeout absorbs the brief lock a
        // second connection (e.g. a snapshot) can hold. No foreign_keys pragma:
        // the schema has no relations. SQLCipher has no such default pragmas.
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA temp_store = MEMORY;
             PRAGMA busy_timeout = 5000;",
        )?;

        // Force key verification on an existing DB (a wrong key errors only on read).
        if existed {
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
                r.get::<_, i64>(0)
            })
            .map_err(|_| StoreError::Other("cannot open database (wrong key?)".into()))?;
        }

        // A vault stamped by a newer build must surface as "update the app",
        // never as a key failure — for a password manager, a fake "wrong
        // password" is the worst possible misdiagnosis.
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version > schema_version() {
            return Err(StoreError::SchemaNewer);
        }

        // Apply pending schema migrations on the decrypted DB (tracked via
        // `user_version`; idempotent — a no-op once the DB is at the latest).
        migrations()
            .to_latest(&mut conn)
            .map_err(|e| StoreError::Other(e.to_string()))?;

        set_mode(path, 0o600);
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Write a consistent, still-encrypted snapshot of the live DB to `dest`
    /// using SQLite's online-backup API. Unlike `fs::copy` of a WAL-mode file,
    /// this reads *through* the connection, so it always captures committed WAL
    /// frames a plain copy could miss (or tear). `dest` is keyed with the same
    /// `key`, so the snapshot is as encrypted as the source — never a plaintext
    /// leak — and reopens as a normal store.
    pub fn snapshot_to(&self, dest: &Path, key: &[u8]) -> Result<()> {
        let mut dst = Connection::open(dest)?;
        dst.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex(key)))?;
        let src = self.lock();
        let backup = rusqlite::backup::Backup::new(&src, &mut dst)?;
        backup.run_to_completion(100, std::time::Duration::from_millis(50), None)?;
        drop(backup);
        drop(dst);
        set_mode(dest, 0o600);
        Ok(())
    }

    /// Re-encrypt the whole database in place under `new_key` (SQLCipher
    /// `PRAGMA rekey`). The open connection stays valid and keyed with the new
    /// key afterwards. Used by change-master-password after the payloads have
    /// been re-encrypted under the new app key.
    pub fn rekey(&self, new_key: &[u8]) -> Result<()> {
        self.lock()
            .execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", hex(new_key)))?;
        Ok(())
    }

    /// Test seam: stamp the DB as if a future build had migrated it further.
    #[cfg(test)]
    pub(crate) fn set_user_version(&self, version: i64) -> Result<()> {
        self.lock()
            .execute_batch(&format!("PRAGMA user_version = {version}"))?;
        Ok(())
    }

    /// Fetch one row by id **including tombstones**, unlike [`VaultStore::get`]
    /// which hides them. Restore and purge both act on rows the live read cannot
    /// see, and both report back the row they wrote.
    pub fn row(&self, id: &str) -> Result<Option<Record>> {
        let conn = self.lock();
        let sql = format!("SELECT {COLS} FROM entries WHERE id = ?1");
        Ok(conn
            .query_row(&sql, params![id], row_to_record)
            .optional()?)
    }

    /// Set the derived card-network slug without stamping `updated_at` — it is
    /// derived metadata, not a user edit (used by the one-time unlock backfill).
    pub fn set_card_brand(&self, id: &str, brand: &str) -> Result<()> {
        self.lock().execute(
            "UPDATE entries SET card_brand = ?1 WHERE id = ?2",
            params![brand, id],
        )?;
        Ok(())
    }

    /// Merge foreign records into the vault, last-writer-wins per id, in one
    /// transaction. Returns how many rows were written.
    ///
    /// A record wins when its `updated_at` is strictly newer, or — on an exact
    /// timestamp tie — when its [`record_hash`] sorts higher bytewise. That
    /// tie-break is the whole reason this is not a plain "newer or keep local":
    /// "keep local" is not commutative, so on a tie two devices each keep their
    /// own row, every sync sees a difference, and they ping-pong pushes forever
    /// without ever converging. Ordering by content hash makes the merge a true
    /// join — idempotent, commutative, associative — so both sides
    /// independently pick the same winner and the vaults converge. Equal
    /// timestamp *and* equal hash is the same content, so nothing is written.
    ///
    /// Tombstones take part like any other row (they are looked up, and they
    /// can win or lose), which is what makes "deleted on one device" and
    /// "edited on another" resolve by time rather than by which side ran first.
    ///
    /// Winners are written verbatim: no timestamp is stamped here, or the
    /// merged row would immediately look newer than its source everywhere else.
    pub fn merge_records(&self, recs: &[Record]) -> Result<usize> {
        let mut conn = self.lock();
        let tx = conn.transaction()?;
        let mut changed = 0usize;
        {
            // Tombstones must be visible here, so this reads the raw row rather
            // than going through `get` (which hides them).
            let mut find = tx.prepare(&format!("SELECT {COLS} FROM entries WHERE id = ?1"))?;
            let mut write = tx.prepare(&verbatim_upsert())?;

            for incoming in recs {
                let local: Option<Record> = find
                    .query_row(params![incoming.id], row_to_record)
                    .optional()?;

                let wins = match &local {
                    None => true,
                    Some(local) => {
                        incoming.updated_at > local.updated_at
                            || (incoming.updated_at == local.updated_at
                                && record_hash(incoming) > record_hash(local))
                    }
                };

                if wins {
                    exec_record(&mut write, incoming)?;
                    changed += 1;
                }
            }
        }
        tx.commit()?;
        Ok(changed)
    }

    /// Fingerprint of the whole entry table, tombstones included. Two vaults
    /// hold the same entry state exactly when their digests match, which is the
    /// sync engine's push decision: push when the digests differ, full stop.
    pub fn state_digest(&self) -> Result<[u8; 32]> {
        Ok(state_digest(&self.export_for_sync()?))
    }

    /// Delete every `meta` row whose key starts with `prefix`, returning how
    /// many were removed.
    ///
    /// Matched with `substr`, not `LIKE`: `_` is a LIKE wildcard, so the literal
    /// prefix `sync_` would also match `syncX…` — a silent over-delete.
    pub fn meta_delete_prefix(&self, prefix: &str) -> Result<usize> {
        Ok(self.lock().execute(
            "DELETE FROM meta WHERE substr(key, 1, length(?1)) = ?1",
            params![prefix],
        )?)
    }

    /// Hard-delete tombstones deleted before `cutoff_ms`, returning the number
    /// of rows reclaimed.
    ///
    /// Tombstones cannot be kept forever, and dropping one is not free: a device
    /// that has been offline since before the cutoff still holds the row as
    /// live, sees no tombstone to tell it otherwise, and re-pushes it as a new
    /// record — the entry resurrects. A ~90-day cutoff is the trade: only a
    /// device dormant for a full quarter can resurrect anything, and the vault
    /// does not grow without bound. Deciding *when* to call this (never before
    /// the tombstone has been pushed at least once, or the delete is lost
    /// instead of propagated) belongs to the sync engine, not the store.
    pub fn purge_tombstones_before(&self, cutoff_ms: i64) -> Result<usize> {
        Ok(self.lock().execute(
            "DELETE FROM entries WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
            params![cutoff_ms],
        )?)
    }
}

impl VaultStore for SqliteStore {
    fn meta_get(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .lock()
            .query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
                r.get(0)
            })
            .optional()?)
    }

    fn meta_set(&self, key: &str, value: &str) -> Result<()> {
        self.lock().execute(META_UPSERT, params![key, value])?;
        Ok(())
    }

    fn list(&self) -> Result<Vec<EntryMeta>> {
        let conn = self.lock();
        let sql = format!("SELECT {META_COLS} FROM entries WHERE deleted_at IS NULL ORDER BY id");
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], row_to_meta)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    fn list_deleted(&self) -> Result<Vec<EntryMeta>> {
        let conn = self.lock();
        // A purged row keeps its tombstone (sync needs it) but has no payload
        // left, so an empty payload is exactly "already permanently deleted".
        let sql = format!(
            "SELECT {META_COLS} FROM entries
             WHERE deleted_at IS NOT NULL AND length(payload) > 0
             ORDER BY deleted_at DESC, id"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], row_to_meta)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    fn get(&self, id: &str) -> Result<Option<Record>> {
        let conn = self.lock();
        let sql = format!("SELECT {COLS} FROM entries WHERE id = ?1 AND deleted_at IS NULL");
        Ok(conn
            .query_row(&sql, params![id], row_to_record)
            .optional()?)
    }

    fn upsert(&self, rec: &Record) -> Result<()> {
        let now = now_ms();
        let conn = self.lock();
        // created_at is set only on insert; updated_at is always stamped to now.
        // `favorite` is deliberately absent from the update set: the star is not
        // part of the entry the editor round-trips, so an ordinary save must
        // leave whatever `set_favorite` last wrote alone.
        conn.execute(
            &format!(
                "INSERT INTO entries ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
                 ON CONFLICT(id) DO UPDATE SET
                   kind=excluded.kind, title=excluded.title, tags=excluded.tags,
                   url_host=excluded.url_host, updated_at=excluded.updated_at,
                   deleted_at=excluded.deleted_at, payload=excluded.payload,
                   card_brand=excluded.card_brand"
            ),
            params![
                rec.id,
                rec.kind,
                rec.title,
                rec.tags,
                rec.url_host,
                if rec.created_at == 0 {
                    now
                } else {
                    rec.created_at
                },
                now,
                rec.deleted_at,
                rec.payload,
                rec.card_brand,
                rec.favorite,
            ],
        )?;
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let now = now_ms();
        let conn = self.lock();
        conn.execute(
            "UPDATE entries SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    fn restore(&self, id: &str) -> Result<()> {
        let now = now_ms();
        self.lock().execute(
            "UPDATE entries SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    /// Discard a tombstoned record's contents for good.
    ///
    /// A bare `DELETE` would not survive sync: every push is the whole state and
    /// [`SqliteStore::merge_records`] re-inserts any id it does not already hold,
    /// so a peer still carrying the tombstone would hand the row — sealed payload
    /// included — straight back on the next merge. Emptying the row in place and
    /// stamping `updated_at` instead makes the purge *win* that merge, which
    /// destroys the payload on every device rather than only this one. What is
    /// left is a content-free tombstone, reclaimed later by
    /// [`SqliteStore::purge_tombstones_before`] like any other.
    fn purge(&self, id: &str) -> Result<()> {
        let now = now_ms();
        self.lock().execute(
            "UPDATE entries
             SET payload = x'', title = '', tags = '[]', url_host = '',
                 card_brand = NULL, favorite = 0, updated_at = ?1
             WHERE id = ?2 AND deleted_at IS NOT NULL",
            params![now, id],
        )?;
        Ok(())
    }

    fn set_favorite(&self, id: &str, favorite: bool) -> Result<()> {
        // `updated_at` moves because the sync merge is last-writer-wins on it: a
        // star that left the clock alone would lose to (or coin-flip against, via
        // the hash tie-break) every peer's copy and silently revert.
        let now = now_ms();
        self.lock().execute(
            "UPDATE entries SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
            params![favorite, now, id],
        )?;
        Ok(())
    }

    fn export_for_sync(&self) -> Result<Vec<Record>> {
        let conn = self.lock();
        let sql = format!("SELECT {COLS} FROM entries ORDER BY id");
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], row_to_record)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    fn import(&self, recs: &[Record]) -> Result<()> {
        let mut conn = self.lock();
        let tx = conn.transaction()?;
        {
            // Bulk sync-in: timestamps are preserved verbatim (no stamping), and
            // every incoming row clobbers unconditionally — unlike merge_records,
            // this is a user restoring a file, not a peer proposing changes.
            let mut stmt = tx.prepare(&verbatim_upsert())?;
            for r in recs {
                exec_record(&mut stmt, r)?;
            }
        }
        tx.commit()?;
        Ok(())
    }
}

// One full-row write that keeps the record's own timestamps — the shape both
// sync-in paths (import, merge_records) need.
fn verbatim_upsert() -> String {
    format!(
        "INSERT INTO entries ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
         ON CONFLICT(id) DO UPDATE SET
           kind=excluded.kind, title=excluded.title, tags=excluded.tags,
           url_host=excluded.url_host, created_at=excluded.created_at,
           updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
           payload=excluded.payload, card_brand=excluded.card_brand,
           favorite=excluded.favorite"
    )
}

fn exec_record(stmt: &mut Statement, r: &Record) -> rusqlite::Result<usize> {
    stmt.execute(params![
        r.id,
        r.kind,
        r.title,
        r.tags,
        r.url_host,
        r.created_at,
        r.updated_at,
        r.deleted_at,
        r.payload,
        r.card_brand,
        r.favorite,
    ])
}

fn row_to_record(row: &Row) -> rusqlite::Result<Record> {
    Ok(Record {
        id: row.get(0)?,
        kind: row.get(1)?,
        title: row.get(2)?,
        tags: row.get(3)?,
        url_host: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        deleted_at: row.get(7)?,
        payload: row.get(8)?,
        card_brand: row.get(9)?,
        favorite: row.get(10)?,
    })
}

fn row_to_meta(row: &Row) -> rusqlite::Result<EntryMeta> {
    Ok(EntryMeta {
        id: row.get(0)?,
        kind: row.get(1)?,
        title: row.get(2)?,
        tags: row.get(3)?,
        url_host: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        deleted_at: row.get(7)?,
        card_brand: row.get(8)?,
        favorite: row.get(9)?,
    })
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(unix)]
fn set_mode(path: &Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(mode));
}

// TODO: tighten Windows ACLs to the current user; std has no chmod analog.
#[cfg(not(unix))]
fn set_mode(_path: &Path, _mode: u32) {}
