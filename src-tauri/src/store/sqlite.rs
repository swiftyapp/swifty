//! SQLite + SQLCipher backend for [`VaultStore`]. A single `Mutex<Connection>`
//! guards a WAL-mode, whole-file-encrypted database. No pool, no async, no ORM.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension, Row};

use super::{now_ms, EntryMeta, Record, Result, StoreError, VaultStore};

const SCHEMA_VERSION: &str = "1";

const SCHEMA: &str = "\
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  kind       TEXT,
  title      TEXT,
  tags       TEXT,
  url_host   TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  deleted_at INTEGER,
  payload    BLOB
);";

const COLS: &str = "id, kind, title, tags, url_host, created_at, updated_at, deleted_at, payload";
const META_COLS: &str = "id, kind, title, tags, url_host, created_at, updated_at, deleted_at";

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

        let conn = Connection::open(path)?;
        // Raw-key pragma: the hex bytes are the key, not a passphrase.
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex(key)))?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;

        // Force key verification on an existing DB (a wrong key errors only on read).
        if existed {
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
                r.get::<_, i64>(0)
            })
            .map_err(|_| StoreError::Other("cannot open database (wrong key?)".into()))?;
        }

        conn.execute_batch(SCHEMA)?;
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?1)",
            params![SCHEMA_VERSION],
        )?;

        set_mode(path, 0o600);
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
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
                "INSERT INTO entries ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
                 ON CONFLICT(id) DO UPDATE SET
                   kind=excluded.kind, title=excluded.title, tags=excluded.tags,
                   url_host=excluded.url_host, updated_at=excluded.updated_at,
                   deleted_at=excluded.deleted_at, payload=excluded.payload"
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
                "INSERT INTO entries ({COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
                 ON CONFLICT(id) DO UPDATE SET
                   kind=excluded.kind, title=excluded.title, tags=excluded.tags,
                   url_host=excluded.url_host, created_at=excluded.created_at,
                   updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
                   payload=excluded.payload"
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
