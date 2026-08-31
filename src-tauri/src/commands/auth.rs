use crate::commands::{
    create_vault, derive_key, open_with_key, record_kdf_meta, store_err, unlock_with_password,
};
use crate::crypto::{self, KdfParams, PayloadCipher, VaultKey};
use crate::error::{Error, Result};
use crate::models::{EntryMetaDto, UnlockResult};
use crate::secure_store::{self, KeyStore};
use crate::state::AppState;
use crate::store::{Record, SqliteStore, VaultStore};
use crate::{biometrics, storage};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, State};

// True only when a SQLite vault DB exists. A legacy `vault.swftx` alone does NOT
// count: the app starts fresh with an empty vault and offers an explicit
// "Import from .swftx" instead (see `import_swftx`).
#[tauri::command]
pub fn is_initialized(app: AppHandle) -> Result<bool> {
    storage::ensure_migrated(&app);
    Ok(storage::db_exists(&app))
}

// Create a brand-new, empty encrypted store protected by `password` (Argon2id +
// a fresh KDF sidecar). The payload key is held in the session, never persisted.
#[tauri::command]
pub fn setup(password: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let (key, store) = create_vault(&app, &password)?;
    state.session.lock().unwrap().set(key, store, false);
    Ok(())
}

// Unlock with the master password: read the KDF sidecar, derive the key, open the
// existing store, and return the entry metadata list. The Argon2id derive + the
// SQLCipher open both run on a blocking thread so the UI is never stalled; unlock
// never migrates anything.
#[tauri::command]
pub async fn unlock(
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    let (key, store, entries) = unlock_off_thread(&app, password).await?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(key, store, sync_configured);
    Ok(UnlockResult {
        entries,
        sync_configured,
    })
}

// Run the Argon2id derive + SQLCipher open (both CPU-bound) on a blocking thread.
async fn unlock_off_thread(
    app: &AppHandle,
    password: String,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || unlock_with_password(&app, &password))
        .await
        .map_err(|e| Error::Other(e.to_string()))?
}

// Open the store for an already-resolved key (biometric path) off the UI thread.
async fn open_off_thread(
    app: &AppHandle,
    key: VaultKey,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (store, entries) = open_with_key(&app, &key)?;
        Ok((key, store, entries))
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

// Clear the in-memory key and close the store.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<()> {
    state.session.lock().unwrap().clear();
    Ok(())
}

// Unlock from a locked start using the biometric-gated key in the OS secure
// store. Retrieving the key triggers the biometric prompt; the sidecar decides
// how to interpret the stored bytes (Argon2id master vs legacy secret). The
// store then opens off the UI thread. No migration on unlock.
#[tauri::command]
pub async fn unlock_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    if !storage::biometric_enrolled(&app) {
        return Err(Error::Other("biometric unlock is not enabled".into()));
    }
    let material = match secure_store::Platform.retrieve() {
        Ok(k) => k,
        Err(Error::NotFound) => {
            // The OS invalidated the item (e.g. enrolled fingerprints changed).
            // Clear the stale marker so we stop offering a broken affordance.
            let _ = storage::set_biometric_enrolled(&app, false);
            return Err(Error::NotFound);
        }
        Err(e) => return Err(e),
    };
    // A sidecar means the stored bytes are an Argon2id master; without one they
    // are the legacy secret string (a pre-sidecar dev vault).
    let key = match storage::read_kdf_sidecar(&app)? {
        Some(_) => VaultKey::Argon2 { master: material },
        None => VaultKey::Legacy { secret: material },
    };
    let (key, store, entries) = open_off_thread(&app, key).await?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(key, store, sync_configured);
    Ok(UnlockResult {
        entries,
        sync_configured,
    })
}

// True only when the platform supports a biometric-gated store, the biometric
// hardware is available, and a key has been enrolled (opt-in).
#[tauri::command]
pub fn is_biometric_available(app: AppHandle) -> Result<bool> {
    Ok(secure_store::is_supported()
        && biometrics::is_available()
        && storage::biometric_enrolled(&app))
}

// Opt in: store the current session's key material in the OS secure store,
// biometry-gated. Requires an unlocked vault.
#[tauri::command]
pub fn enable_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if !secure_store::is_supported() || !biometrics::is_available() {
        return Err(Error::Other("biometrics not available".into()));
    }
    {
        let session = state.session.lock().unwrap();
        secure_store::Platform.store(session.key()?.biometric_material())?;
    }
    storage::set_biometric_enrolled(&app, true)?;
    Ok(())
}

// Opt out: delete the stored key and clear the marker.
#[tauri::command]
pub fn disable_biometric(app: AppHandle) -> Result<()> {
    secure_store::Platform.delete()?;
    storage::set_biometric_enrolled(&app, false)?;
    Ok(())
}

// Re-derive a fresh Argon2id key (new salt), re-seal every payload under the new
// payload key, re-key the encrypted DB and rewrite the sidecar. Correct even if
// slow: touches every row once. Requires an unlocked session.
//
// Crash-consistency: the three destructive on-disk steps (import → rekey →
// sidecar) are guarded by a recovery snapshot taken first. The sidecar (the
// single source of truth for opening) is written last and atomically, so it only
// ever names a DB already re-keyed to match. On any failure the pre-change,
// old-keyed DB is restored from the snapshot and the OLD sidecar is left in place,
// so the vault still opens under the unchanged current password.
#[tauri::command]
pub fn change_master_password(
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    // Hold the session lock throughout: no other command sees the half-open state
    // while the store is out of the session.
    let mut session = state.session.lock().unwrap();

    // Verify the current password reproduces the unlocked session key.
    if derive_key(&app, &current)?.sqlcipher_key() != session.key()?.sqlcipher_key() {
        return Err(Error::InvalidPassword);
    }

    // Own the open store + key for the duration so we can drop and restore them.
    let store = session.store.take().ok_or(Error::Locked)?;
    let old_key = session.key.take().ok_or(Error::Locked)?;

    // Fresh Argon2id key (new salt). Nothing on disk is touched yet, so on failure
    // just put the untouched store/key back.
    let params = KdfParams::default_argon2id();
    let new_key = match crypto::derive(new.as_bytes(), &params) {
        Ok(master) => VaultKey::Argon2 { master },
        Err(e) => {
            session.set_keyed(old_key, store);
            return Err(e);
        }
    };

    // Recovery point: snapshot the pre-change (old-keyed) DB to a sibling file.
    let backup = storage::db_rekey_backup_path(&app)?;
    if let Err(e) = store.snapshot_to(&backup, &old_key.sqlcipher_key()) {
        let _ = fs::remove_file(&backup);
        session.set_keyed(old_key, store);
        return Err(store_err(e));
    }

    // Destructive sequence. On any error, roll back to the snapshot.
    if let Err(e) = rekey_vault(&store, &old_key, &new_key, &params, &app) {
        // Close the (possibly re-keyed) connection, copy the old-keyed snapshot
        // back over the DB, and reopen under the OLD key (the current password is
        // unchanged). The OLD sidecar is still on disk (it is rewritten only on a
        // successful rekey), so the restored DB opens. Keep the snapshot as a
        // last-resort artifact if the reopen itself fails.
        drop(store);
        match restore_db_from_backup(&app, &backup).and_then(|()| open_with_key(&app, &old_key)) {
            Ok((restored, _)) => session.set_keyed(old_key, restored),
            Err(_) => session.clear(),
        }
        return Err(e);
    }

    // Success: the change is committed on disk. Drop the recovery point.
    let _ = fs::remove_file(&backup);

    // Re-encrypt the Drive token file under the new key if present (sync parity).
    let token = storage::read_gdrive(&app).unwrap_or_default();
    if !token.is_empty() {
        if let Ok(plain) = old_key.cryptor().decrypt(&token) {
            storage::write_gdrive(&app, &new_key.cryptor().encrypt(&plain)?)?;
        }
    }

    // Adopt the new key + store for the live session.
    session.set_keyed(new_key, store);
    drop(session);

    // The biometric-stored key is now stale; re-store the new material or clear it.
    if storage::biometric_enrolled(&app) {
        let session = state.session.lock().unwrap();
        let stored = secure_store::Platform.store(session.key()?.biometric_material());
        drop(session);
        if stored.is_err() {
            let _ = secure_store::Platform.delete();
            let _ = storage::set_biometric_enrolled(&app, false);
        }
    }
    Ok(())
}

// The destructive on-disk sequence, isolated so a single `?` failure triggers the
// snapshot rollback in the caller. Sidecar (atomic) written last, after the rekey.
fn rekey_vault(
    store: &SqliteStore,
    old_key: &VaultKey,
    new_key: &VaultKey,
    params: &KdfParams,
    app: &AppHandle,
) -> Result<()> {
    let old_cipher = old_key.payload_cipher();
    let new_cipher = new_key.payload_cipher();
    // Re-seal every row's payload under the new payload key (timestamps + tombstones kept).
    let resealed: Vec<Record> = store
        .export_for_sync()
        .map_err(store_err)?
        .into_iter()
        .map(|r| reseal_record(r, &old_cipher, &new_cipher))
        .collect::<Result<_>>()?;
    store.import(&resealed).map_err(store_err)?;
    store.rekey(&new_key.sqlcipher_key()).map_err(store_err)?;
    record_kdf_meta(store, params)?;
    storage::write_kdf_sidecar(app, &params.to_json()?)?;
    Ok(())
}

// Roll the DB file back to the pre-change snapshot. The connection must already be
// closed. Stale WAL/SHM sidecars are removed so they can't overlay the restored
// (old-keyed) file with new-keyed frames.
fn restore_db_from_backup(app: &AppHandle, backup: &Path) -> Result<()> {
    let db = storage::db_path(app)?;
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = db.clone().into_os_string();
        sidecar.push(suffix);
        let _ = fs::remove_file(std::path::PathBuf::from(sidecar));
    }
    fs::copy(backup, &db)?;
    Ok(())
}

// Unseal a record's payload under the old cipher and re-seal it under the new one,
// preserving all metadata (id/kind/title/tags/url_host/timestamps/tombstone).
fn reseal_record(mut r: Record, old: &PayloadCipher, new: &PayloadCipher) -> Result<Record> {
    let entry = old.unseal(&r.payload)?;
    r.payload = new.seal(&entry)?;
    Ok(r)
}
