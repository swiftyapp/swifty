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
// payload key, then re-key the encrypted DB and rewrite the sidecar. Correct even
// if slow: touches every row once. Requires an unlocked session.
#[tauri::command]
pub fn change_master_password(
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let mut session = state.session.lock().unwrap();

    // Verify the current password reproduces the unlocked session key.
    let current_key = derive_key(&app, &current)?;
    if current_key.sqlcipher_key() != session.key()?.sqlcipher_key() {
        return Err(Error::InvalidPassword);
    }

    // Old ciphers from the session; fresh Argon2id key (new salt) for the new one.
    let old_cipher = session.key()?.payload_cipher();
    let old_cryptor = session.key()?.cryptor();
    let params = KdfParams::default_argon2id();
    let new_key = VaultKey::Argon2 {
        master: crypto::derive(new.as_bytes(), &params)?,
    };
    let new_cipher = new_key.payload_cipher();
    let new_cryptor = new_key.cryptor();
    let new_db_key = new_key.sqlcipher_key();

    let store = session.store()?;
    // Re-seal every row's payload under the new payload key (timestamps + tombstones kept).
    let resealed: Vec<Record> = store
        .export_for_sync()
        .map_err(store_err)?
        .into_iter()
        .map(|r| reseal_record(r, &old_cipher, &new_cipher))
        .collect::<Result<_>>()?;
    store.import(&resealed).map_err(store_err)?;
    // Re-encrypt the DB file itself under the new SQLCipher key, then make the new
    // descriptor authoritative. (Sidecar written after the rekey so it only ever
    // describes a DB already re-keyed to match.)
    store.rekey(&new_db_key).map_err(store_err)?;
    record_kdf_meta(store, &params)?;
    storage::write_kdf_sidecar(&app, &params.to_json()?)?;

    // Re-encrypt the Drive token file under the new key if present (sync parity).
    let token = storage::read_gdrive(&app).unwrap_or_default();
    if !token.is_empty() {
        if let Ok(plain) = old_cryptor.decrypt(&token) {
            storage::write_gdrive(&app, &new_cryptor.encrypt(&plain)?)?;
        }
    }

    // Swap in the new key for the live session.
    session.key = Some(new_key);
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

// Unseal a record's payload under the old cipher and re-seal it under the new one,
// preserving all metadata (id/kind/title/tags/url_host/timestamps/tombstone).
fn reseal_record(mut r: Record, old: &PayloadCipher, new: &PayloadCipher) -> Result<Record> {
    let entry = old.unseal(&r.payload)?;
    r.payload = new.seal(&entry)?;
    Ok(r)
}
