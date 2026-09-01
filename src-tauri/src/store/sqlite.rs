//! SQLite + SQLCipher backend for [`VaultStore`]. A single `Mutex<Connection>`
//! guards a WAL-mode, whole-file-encrypted database. No pool, no async, no ORM.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension, Row};
use rusqlite_migration::{Migrations, M};

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
    ]
}

// card_brand is appended last so pre-existing column indexes stay put.
const COLS: &str =
    "id, kind, title, tags, url_host, created_at, updated_at, deleted_at, payload, card_brand";
const META_COLS: &str =
    "id, kind, title, tags, url_host, created_at, updated_at, deleted_at, card_brand";

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

    /// Set the derived card-network slug without stamping `updated_at` — it is
    /// derived metadata, not a user edit (used by the one-time unlock backfill).
    pub fn set_card_brand(&self, id: &str, brand: &str) -> Result<()> {
        self.lock().execute(
            "UPDATE entries SET card_brand = ?1 WHERE id = ?2",
            params![brand, id],
        )?;
        Ok(())
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
        self.lock().execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    fn list(&self) -> Result<Vec<EntryMeta>> {
        let conn = self.lock();
        let sql = format!("SELECT {META_COLS} FROM entries WHERE deleted_at IS NULL ORDER BY id");
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
        // created_at is set only on insert; updated_at is always stamped to now.
        self.lock().execute(
            &format!(
                "INSERT INTO entries ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
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
            ],
        )?;
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<()> {
        let now = now_ms();
        self.lock().execute(
            "UPDATE entries SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
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
            // Bulk sync-in: timestamps are preserved verbatim (no stamping).
            let mut stmt = tx.prepare(&format!(
                "INSERT INTO entries ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
                 ON CONFLICT(id) DO UPDATE SET
                   kind=excluded.kind, title=excluded.title, tags=excluded.tags,
                   url_host=excluded.url_host, created_at=excluded.created_at,
                   updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
                   payload=excluded.payload, card_brand=excluded.card_brand"
            ))?;
            for r in recs {
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
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }
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
