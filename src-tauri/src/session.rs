//! The unlocked vault: the in-memory session, and the vault-opening helpers
//! every command reaches for.

use tauri::AppHandle;

use crate::crypto::{self, Cryptor, KdfParams, PayloadCipher, VaultKey};
use crate::error::{Error, Result};
use crate::models::EntryMetaDto;
use crate::storage;
use crate::store::{EntryMeta, Record, SqliteStore, StoreError, VaultStore};

// In-memory session. The vault key never leaves Rust; the frontend only ever
// receives non-secret entry metadata for the list and one decrypted entry at a
// time (reveal). The open, encrypted store handle lives here — not a decrypted
// vault — so plaintext secrets are never all held in memory.
#[derive(Default)]
pub struct Session {
    // The active vault key (Argon2id master or legacy secret). It owns its own
    // zeroize-on-drop, so the material is scrubbed on lock/clear/replace.
    pub key: Option<VaultKey>,
    // The open SQLCipher store. Dropped (connection closed) on lock.
    pub store: Option<SqliteStore>,
    pub sync_configured: bool,
}

impl Session {
    pub fn is_unlocked(&self) -> bool {
        self.key.is_some()
    }

    // The held vault key, or fail if locked.
    pub fn key(&self) -> Result<&VaultKey> {
        self.key.as_ref().ok_or(Error::Locked)
    }

    // The per-entry payload cipher for this session, or fail if locked.
    pub fn payload_cipher(&self) -> Result<PayloadCipher> {
        Ok(self.key()?.payload_cipher())
    }

    // The legacy Cryptor. Live: it seals the Drive token file, the shares this
    // vault publishes, and the `.swftx` backups it reads.
    pub fn cryptor(&self) -> Result<Cryptor> {
        Ok(self.key()?.cryptor())
    }

    // Borrow the open store, or fail if locked.
    pub fn store(&self) -> Result<&SqliteStore> {
        self.store.as_ref().ok_or(Error::Locked)
    }

    // Adopt the derived key and open store for this session.
    pub fn set(&mut self, key: VaultKey, store: SqliteStore, sync_configured: bool) {
        self.key = Some(key);
        self.store = Some(store);
        self.sync_configured = sync_configured;
    }

    // Re-adopt a key + store, leaving sync_configured untouched. Used by
    // change-master-password's success and rollback paths, where the store is
    // taken out of the session and later put back (or replaced by a restore).
    pub fn set_keyed(&mut self, key: VaultKey, store: SqliteStore) {
        self.key = Some(key);
        self.store = Some(store);
    }

    // Drop the in-memory key and close the store. Used by the inactivity auto-lock.
    pub fn clear(&mut self) {
        self.key = None;
        self.store = None;
        self.sync_configured = false;
    }
}

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
    backfill_derived_columns(&store, key);
    let metas = list_metas(&store)?;
    Ok((store, metas))
}

// Derivation for the metadata columns added after a row was written: unseal each
// candidate once and stamp what its payload says. Best-effort — a failure just
// leaves the row for the next unlock.
//
// `card_brand` is a candidate while NULL, so that work stops for good once every
// card is stamped. `has_passkey` has no such marker — the column is NOT NULL
// DEFAULT 0, and 0 is also the truth for every login that simply has no passkey
// — so an unflagged login is re-checked on each unlock. That is the same set of
// payloads the post-unlock audit unseals anyway, and it is self-healing: a row
// arriving from a peer still on an older build gets corrected here too.
//
// An env row's `file_name` and `var_count` follow the `card_brand` shape: the
// count is `Some` for every stamped env entry, so a NULL count is the marker,
// and a file that simply has no name stays NULL there without re-running.
fn backfill_derived_columns(store: &SqliteStore, key: &VaultKey) {
    let Ok(metas) = store.list() else { return };
    let cipher = key.payload_cipher();
    for meta in metas {
        let brand_missing = meta.kind == "card" && meta.card_brand.is_none();
        let passkey_unflagged = meta.kind == "login" && !meta.has_passkey;
        let env_unstamped = meta.kind == "env" && meta.var_count.is_none();
        if !brand_missing && !passkey_unflagged && !env_unstamped {
            continue;
        }
        let Ok(Some(record)) = store.get(&meta.id) else {
            continue;
        };
        let Ok(entry) = cipher.unseal(&record.payload) else {
            continue;
        };
        if brand_missing {
            if let Some(brand) = crate::store::migrate::derived_card_brand(&entry) {
                let _ = store.set_card_brand(&meta.id, &brand);
            }
        }
        // Only ever raised here: a stale `true` cannot survive, since every
        // `upsert` recomputes the flag from the payload it is writing.
        if passkey_unflagged && crate::store::migrate::derived_has_passkey(&entry) {
            let _ = store.set_has_passkey(&meta.id, true);
        }
        if env_unstamped {
            if let Some(count) = crate::store::migrate::derived_var_count(&entry) {
                let name = crate::store::migrate::derived_file_name(&entry);
                let _ = store.set_env_meta(&meta.id, name.as_deref(), count);
            }
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

// Look one row's metadata up by id (used by the commands that must report back
// the row they just wrote). Tombstones are visible here: restore and purge both
// need to read a row the live `get` hides.
pub fn meta_dto_of(store: &SqliteStore, id: &str) -> Result<EntryMetaDto> {
    store
        .row_meta(id)
        .map_err(store_err)?
        .map(|m| EntryMetaDto::from(&m))
        .ok_or(Error::NotFound)
}

pub fn list_metas(store: &SqliteStore) -> Result<Vec<EntryMetaDto>> {
    Ok(metas(store.list().map_err(store_err)?))
}

// Tombstoned entries' metadata — what the Trash lists.
pub fn list_deleted_metas(store: &SqliteStore) -> Result<Vec<EntryMetaDto>> {
    Ok(metas(store.list_deleted().map_err(store_err)?))
}

fn metas(rows: Vec<EntryMeta>) -> Vec<EntryMetaDto> {
    rows.iter().map(EntryMetaDto::from).collect()
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
