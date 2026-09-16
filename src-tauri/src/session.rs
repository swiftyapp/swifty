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

// Open a second connection to the live database, keyed the same way, for one
// long read.
//
// The session's own store may not be borrowed for the length of a pack: a pack
// copies the whole database page by page, and holding the session mutex for that
// blocks every command that only wants a single row — which is what made
// `reveal_entry` stall behind a sync. SQLCipher is happy with a second reader
// (the database is in WAL mode), so the pack reads through one of its own and
// the guard is released the moment this returns.
//
// The caller took the key from the session under the lock, so the connection is
// keyed to the vault as it was at that instant; a re-key landing afterwards
// fails this connection's reads rather than producing a snapshot nobody can
// open.
pub fn open_snapshot_source(app: &AppHandle, key: &[u8]) -> Result<SqliteStore> {
    SqliteStore::open(&storage::db_path(app)?, key).map_err(store_err)
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

/// Where the session guard may not be held — asserted on the source itself.
///
/// The rule this module exists for: [`Session`]'s mutex is held around memory
/// only, never across a KDF, a pack, a network call or a modal prompt. Every
/// command in this app shares that one lock, so a guard alive across any of them
/// stalls all of them — that is what made `reveal_entry` queue behind a sync's
/// VACUUM and behind Argon2id on an export.
///
/// Nothing in the type system says so: a guard is just a value, and holding one
/// too long is a shape, not an error. So these are tripwires rather than proofs.
/// They read the source of the four functions that had it wrong and assert the
/// order their statements are in, so re-introducing the old shape fails the
/// build with the reason attached.
#[cfg(test)]
mod lock_scope {
    // Everything above the test module: the fakes below it borrow nothing from
    // the real session and would only confuse the search.
    fn production(source: &str) -> &str {
        match source.find("#[cfg(test)]") {
            Some(at) => &source[..at],
            None => source,
        }
    }

    // The brace-matched body of the function `signature` introduces, with
    // full-line comments dropped so prose about a lock never reads as one.
    fn body_of(source: &str, signature: &str) -> String {
        let source = production(source);
        let start = source
            .find(signature)
            .unwrap_or_else(|| panic!("`{signature}` is gone — keep this guard in step with it"));
        let open = start + source[start..].find('{').expect("a function has a body");
        let mut depth = 0usize;
        let mut end = None;
        for (i, c) in source[open..].char_indices() {
            match c {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        end = Some(open + i);
                        break;
                    }
                }
                _ => {}
            }
        }
        source[open..=end.expect("balanced braces")]
            .lines()
            .filter(|line| !line.trim_start().starts_with("//"))
            .collect::<Vec<_>>()
            .join("\n")
    }

    // Where `needle` occurs in `body`, or a failure naming what went missing.
    fn at(body: &str, needle: &str) -> usize {
        body.find(needle)
            .unwrap_or_else(|| panic!("`{needle}` is gone — keep this guard in step with the code"))
    }

    #[test]
    fn the_sync_pack_does_not_borrow_the_session_store() {
        let engine = include_str!("sync/engine.rs");
        // The trailing brace tells the implementation apart from the trait
        // method it implements, which is a declaration and has no body.
        let pack = body_of(
            engine,
            "fn pack(&self, cutoff_ms: i64) -> Result<Vec<u8>> {",
        );
        at(&pack, "pack_store");
        assert!(
            !pack.contains("with_store") && !pack.contains("with_session"),
            "the pack copies the whole database; it must not run inside the \
             session guard — take the lock for the reclaim and again for the \
             key re-check instead"
        );

        // ...and the step that *does* take the lock stays short.
        let reclaim = body_of(engine, "fn reclaim_and_open(&self, cutoff_ms: i64)");
        at(&reclaim, "with_store");
        assert!(
            !reclaim.contains("pack_store"),
            "the reclaim runs under the guard, so the pack may not move into it"
        );
    }

    #[test]
    fn a_password_change_derives_and_re_keys_outside_the_guard() {
        let body = body_of(
            include_str!("commands/auth.rs"),
            "pub async fn change_master_password(",
        );
        assert!(
            at(&body, "derive_both") < at(&body, "session.lock()"),
            "both Argon2id derives belong before the lock is taken"
        );
        assert!(
            at(&body, "session.lock()") < at(&body, "blocking("),
            "the lock is taken to check the key and take the store out, and \
             released before the saga runs"
        );
        assert!(
            at(&body, "blocking(") < at(&body, "auth::rekey"),
            "the rekey saga runs on the blocking pool, not on a worker"
        );
    }

    #[test]
    fn the_vault_export_derives_and_packs_outside_the_guard() {
        let body = body_of(
            include_str!("commands/vault.rs"),
            "pub async fn export_vault(",
        );
        assert!(
            at(&body, "derive_key") < at(&body, "session.lock()"),
            "the export's Argon2id derive belongs before the lock is taken"
        );
        assert!(
            at(&body, "session.lock()") < at(&body, "pack_store"),
            "the lock is taken to check the key and open a connection of the \
             pack's own; the pack itself runs after it is released"
        );
        at(&body, "open_snapshot_source");
    }

    #[test]
    fn the_entry_export_unseals_from_a_cipher_clone() {
        let import = include_str!("commands/import.rs");
        // The helper takes an owned cipher, which is what lets the unseal leave
        // the guard's scope with the records.
        assert!(
            production(import)
                .contains("fn to_imported(records: &[Record], cipher: &PayloadCipher)"),
            "the export helper must take a cipher, not a session or a guard"
        );

        let body = body_of(import, "pub async fn export_entries(");
        assert!(
            at(&body, "session.lock()") < at(&body, "super::blocking("),
            "the rows and the cipher come out under the lock; the unseal does not"
        );
        assert!(
            at(&body, "super::blocking(") < at(&body, "to_imported"),
            "unsealing every entry is a pass over the whole vault — off the worker"
        );
    }
}
