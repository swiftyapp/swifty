pub mod audit;
pub mod auth;
pub mod clipboard;
pub mod generator;
pub mod sync;
pub mod vault;

use tauri::AppHandle;

use crate::crypto::{self, Cryptor};
use crate::error::{Error, Result};
use crate::models::{Entry, EntryMetaDto};
use crate::storage;
use crate::store::{EntryMeta, Record, SqliteStore, StoreError, VaultStore};

// KDF descriptor recorded in the store `meta` table. A placeholder for Phase 2
// (Argon2id): the app still derives keys from the current PBKDF2-based secret,
// but the descriptor makes the on-disk format self-describing for the upgrade.
pub const KDF_DESCRIPTOR: &str = "pbkdf2-sha512-100000";

pub fn store_err(e: StoreError) -> Error {
    Error::Other(e.to_string())
}

// Decrypt one entry's sensitive fields (legacy per-field ciphertext -> plaintext).
// Used by the (disabled) sync path when adopting a merged remote vault.
pub fn expose_all(cryptor: &Cryptor, entries: &[Entry]) -> Result<Vec<Entry>> {
    entries.iter().map(|e| cryptor.expose(e)).collect()
}

// A store metadata row -> the frontend DTO (no secret fields).
pub fn meta_dto(m: &EntryMeta) -> EntryMetaDto {
    EntryMetaDto::from_parts(
        m.id.clone(),
        m.kind.clone(),
        m.title.clone(),
        &m.tags,
        m.url_host.clone(),
        m.created_at,
        m.updated_at,
    )
}

// A full record -> the frontend metadata DTO (drops the payload).
pub fn record_meta_dto(r: &Record) -> EntryMetaDto {
    EntryMetaDto::from_parts(
        r.id.clone(),
        r.kind.clone(),
        r.title.clone(),
        &r.tags,
        r.url_host.clone(),
        r.created_at,
        r.updated_at,
    )
}

pub fn list_metas(store: &SqliteStore) -> Result<Vec<EntryMetaDto>> {
    Ok(store
        .list()
        .map_err(store_err)?
        .iter()
        .map(meta_dto)
        .collect())
}

// All live records (payloads included, tombstones excluded).
pub fn live_records(store: &SqliteStore) -> Result<Vec<Record>> {
    Ok(store
        .export_for_sync()
        .map_err(store_err)?
        .into_iter()
        .filter(|r| r.deleted_at.is_none())
        .collect())
}

// Open the existing store for `secret` and return the open handle plus the entry
// metadata list. Fresh-start default: a legacy `vault.swftx` is never migrated
// here — importing one is an explicit, off-thread action (see `import_swftx`).
pub fn open_and_load(app: &AppHandle, secret: &str) -> Result<(SqliteStore, Vec<EntryMetaDto>)> {
    let db_key = crypto::sqlcipher_key(secret);
    let db = storage::db_path(app)?;
    // A wrong password derives a wrong SQLCipher key and the open fails
    // verification -> surface as an invalid password.
    let store = SqliteStore::open(&db, &db_key).map_err(|_| Error::InvalidPassword)?;
    let metas = list_metas(&store)?;
    Ok((store, metas))
}
