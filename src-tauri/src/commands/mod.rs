pub mod audit;
pub mod auth;
pub mod clipboard;
pub mod generator;
pub mod sync;
pub mod vault;

use std::fs;
use tauri::AppHandle;

use crate::crypto::{self, Cryptor};
use crate::error::{Error, Result};
use crate::models::{Entry, EntryMetaDto, VaultData};
use crate::storage;
use crate::store::{migrate, EntryMeta, Record, SqliteStore, StoreError, VaultStore};

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

// Open the store for `secret`, running the one-time JSON->DB migration if a
// legacy vault exists and no DB does yet, then return the open handle and the
// metadata list. Migration keeps the JSON as `.bak` and never deletes it.
pub fn open_and_load(app: &AppHandle, secret: &str) -> Result<(SqliteStore, Vec<EntryMetaDto>)> {
    let cryptor = Cryptor::new(secret);
    let db_key = crypto::sqlcipher_key(secret);
    let db = storage::db_path(app)?;

    if !storage::db_exists(app) && storage::vault_exists(app) {
        // Validate the password against the JSON first, so a wrong password never
        // leaves behind an empty DB that would shadow the real vault on retry.
        let blob = storage::read_vault(app)?;
        let _: VaultData = cryptor
            .decrypt_data(&blob)
            .map_err(|_| Error::InvalidPassword)?;

        let store = SqliteStore::open(&db, &db_key).map_err(store_err)?;
        store.meta_set("kdf", KDF_DESCRIPTOR).map_err(store_err)?;
        if let Err(e) = migrate::migrate_from_json(&storage::vault_path(app)?, &cryptor, &store) {
            // Roll back the partial DB (and its WAL sidecars) so the next unlock
            // re-runs migration from the retained JSON.
            drop(store);
            let _ = fs::remove_file(&db);
            for ext in ["db-wal", "db-shm"] {
                let _ = fs::remove_file(db.with_extension(ext));
            }
            return Err(e);
        }
        let metas = list_metas(&store)?;
        return Ok((store, metas));
    }

    // Existing DB: a wrong password derives a wrong SQLCipher key and the open
    // fails verification -> surface as an invalid password.
    let store = SqliteStore::open(&db, &db_key).map_err(|_| Error::InvalidPassword)?;
    let metas = list_metas(&store)?;
    Ok((store, metas))
}
