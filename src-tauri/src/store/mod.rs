//! Self-contained vault storage engine. Depends only on `std`, `rusqlite`,
//! `serde`, and its own error type — never on the app's commands/state/models
//! or Tauri — so the whole layer can be swapped behind [`VaultStore`].
//!
//! The store persists an **opaque** `payload: Vec<u8>`: it never inspects or
//! encrypts it (the caller applies its own AEAD). The only crypto here is
//! SQLCipher at-rest, keyed by a byte key injected at [`SqliteStore::open`].

mod hash;
mod sqlite;

// Migration glue lives in-module but deliberately references the app's crypto —
// it is the boundary adapter, not part of the pure trait.
pub mod migrate;

#[cfg(test)]
mod tests;

pub use hash::{record_hash, state_digest};
pub use sqlite::{SqliteStore, SYNC_META_PREFIX};

use std::time::{SystemTime, UNIX_EPOCH};

/// Storage error. Small and self-owned so the module stays decoupled; the app
/// boundary maps it into the application error type.
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),

    // The DB was stamped by a build with more migrations than this one knows.
    // Kept distinct so the app boundary can say "update the app" instead of
    // the catch-all "wrong password".
    #[error("vault schema is newer than this app version")]
    SchemaNewer,

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, StoreError>;

/// A full stored row: queryable metadata plus the opaque encrypted payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub tags: String,
    pub url_host: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub payload: Vec<u8>,
    /// Card network slug derived from the number at save time ("visa", …);
    /// None for non-cards and for rows saved before the column existed.
    pub card_brand: Option<String>,
    /// Starred by the user. A column rather than a payload field so listings can
    /// filter and pin on it without decrypting anything; [`VaultStore::set_favorite`]
    /// is its only writer outside a sync merge.
    pub favorite: bool,
}

/// A row's metadata without its payload (what listings need).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntryMeta {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub tags: String,
    pub url_host: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub card_brand: Option<String>,
    pub favorite: bool,
}

/// The swappable storage contract. Any backend behind this interface is a drop-in.
pub trait VaultStore: Send {
    /// Read a `meta` value (schema_version, kdf, salt, …). Values are caller-owned.
    fn meta_get(&self, key: &str) -> Result<Option<String>>;
    /// Write a `meta` value.
    fn meta_set(&self, key: &str, value: &str) -> Result<()>;
    /// List live entries' metadata (excludes tombstones).
    fn list(&self) -> Result<Vec<EntryMeta>>;
    /// List tombstoned entries' metadata — what the Trash shows. Excludes rows
    /// already purged (see [`VaultStore::purge`]), newest deletion first.
    fn list_deleted(&self) -> Result<Vec<EntryMeta>>;
    /// Fetch one live record with its payload (`None` if missing or tombstoned).
    fn get(&self, id: &str) -> Result<Option<Record>>;
    /// Insert or update a record, stamping `updated_at` to now.
    fn upsert(&self, rec: &Record) -> Result<()>;
    /// Tombstone a record (`deleted_at = now`); the row is kept for sync.
    fn delete(&self, id: &str) -> Result<()>;
    /// Un-tombstone a record (`deleted_at = NULL`), stamping `updated_at` so the
    /// restore wins the sync merge against the tombstone peers still hold.
    fn restore(&self, id: &str) -> Result<()>;
    /// Discard a tombstoned record's contents for good.
    fn purge(&self, id: &str) -> Result<()>;
    /// Star or unstar a **live** record, stamping `updated_at`; a tombstone has
    /// no star to set, so it is left alone.
    fn set_favorite(&self, id: &str, favorite: bool) -> Result<()>;
    /// Every record including tombstones, with timestamps intact (for sync).
    fn export_for_sync(&self) -> Result<Vec<Record>>;
    /// Bulk-write records in one transaction, preserving their timestamps (sync in).
    fn import(&self, recs: &[Record]) -> Result<()>;
}

/// Milliseconds since the Unix epoch.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
