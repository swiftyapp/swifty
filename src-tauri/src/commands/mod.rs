pub mod audit;
pub mod auth;
pub mod clipboard;
pub mod generator;
pub mod import;
pub mod sync;
pub mod vault;

use tauri::AppHandle;

use crate::crypto::{self, KdfParams, VaultKey};
use crate::error::{Error, Result};
use crate::models::EntryMetaDto;
use crate::storage;
use crate::store::{EntryMeta, Record, SqliteStore, StoreError, VaultStore};

pub fn store_err(e: StoreError) -> Error {
    Error::Other(e.to_string())
}

// Resolve the vault key for `password`: Argon2id when the KDF sidecar is present
// (the current scheme), or the legacy deterministic key when a DB exists without
// a sidecar (interim/dev vaults created before this wiring). Feeds the password
// **directly** to Argon2id — no `hash_secret` pre-hash on this path.
pub fn derive_key(app: &AppHandle, password: &str) -> Result<VaultKey> {
    match storage::read_kdf_sidecar(app)? {
        Some(json) => {
            let params = KdfParams::from_json(&json)?;
            Ok(VaultKey::Argon2 {
                master: crypto::derive(password.as_bytes(), &params)?,
            })
        }
        None => Ok(VaultKey::legacy_from_password(password)),
    }
}

// Open the existing store with `key` and return its handle + entry metadata. A
// wrong key fails SQLCipher's open verification -> surfaced as invalid password.
pub fn open_with_key(app: &AppHandle, key: &VaultKey) -> Result<(SqliteStore, Vec<EntryMetaDto>)> {
    // Everything else that fails an open IS a key problem (SQLCipher can't
    // read a byte of a wrongly-keyed file) — but a schema from a newer build
    // must say so, not send the user doubting their master password.
    let store =
        SqliteStore::open(&storage::db_path(app)?, &key.sqlcipher_key()).map_err(|e| match e {
            StoreError::SchemaNewer => Error::VaultTooNew,
            _ => Error::InvalidPassword,
        })?;
    backfill_card_brands(&store, key);
    let metas = list_metas(&store)?;
    Ok((store, metas))
}

// One-time derivation for cards saved before the card_brand column existed
// (NULL there): unseal each once, store the slug ("none" when unrecognized),
// and it's plain metadata from then on. Best-effort — a failure just leaves
// the row NULL for the next unlock.
fn backfill_card_brands(store: &SqliteStore, key: &VaultKey) {
    let Ok(metas) = store.list() else { return };
    let cipher = key.payload_cipher();
    for meta in metas {
        if meta.kind != "card" || meta.card_brand.is_some() {
            continue;
        }
        let Ok(Some(record)) = store.get(&meta.id) else {
            continue;
        };
        let Ok(entry) = cipher.unseal(&record.payload) else {
            continue;
        };
        if let Some(brand) = crate::store::migrate::derived_card_brand(&entry) {
            let _ = store.set_card_brand(&meta.id, &brand);
        }
    }
}

// Password unlock (run inside spawn_blocking): derive the key, then open + list.
// Fresh-start default: a legacy `vault.swftx` is never migrated here — importing
// one is an explicit, off-thread action (see `import_swftx`).
pub fn unlock_with_password(
    app: &AppHandle,
    password: &str,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let key = derive_key(app, password)?;
    let (store, metas) = open_with_key(app, &key)?;
    Ok((key, store, metas))
}

// Create a brand-new Argon2id-keyed vault: fresh params -> write the sidecar
// (authoritative) -> derive the master -> create the encrypted DB keyed with the
// SQLCipher subkey -> record the KDF descriptor in `meta` too (for reference).
pub fn create_vault(app: &AppHandle, password: &str) -> Result<(VaultKey, SqliteStore)> {
    let params = KdfParams::default_argon2id();
    let descriptor = params.to_json()?;
    // Sidecar first: a DB must never exist without the descriptor needed to open it.
    storage::write_kdf_sidecar(app, &descriptor)?;
    let key = VaultKey::Argon2 {
        master: crypto::derive(password.as_bytes(), &params)?,
    };
    let store =
        SqliteStore::open(&storage::db_path(app)?, &key.sqlcipher_key()).map_err(store_err)?;
    record_kdf_meta(&store, &params)?;
    Ok((key, store))
}

// Mirror the KDF descriptor into `meta` (the sidecar stays authoritative for
// opening; `meta` is reference/integrity only).
pub fn record_kdf_meta(store: &SqliteStore, params: &KdfParams) -> Result<()> {
    store.meta_set("kdf", params.algo()).map_err(store_err)?;
    store
        .meta_set("kdf_params", &params.to_json()?)
        .map_err(store_err)?;
    Ok(())
}

// A store metadata row -> the frontend DTO (no secret fields).
pub fn meta_dto(m: &EntryMeta) -> EntryMetaDto {
    EntryMetaDto::from_parts(
        m.id.clone(),
        m.kind.clone(),
        m.title.clone(),
        &m.tags,
        m.url_host.clone(),
        m.card_brand.clone(),
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
        r.card_brand.clone(),
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
