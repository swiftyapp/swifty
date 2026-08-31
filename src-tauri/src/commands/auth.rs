use crate::commands::{open_and_load, store_err, KDF_DESCRIPTOR};
use crate::error::{Error, Result};
use crate::models::{Entry, UnlockResult};
use crate::secure_store::{self, KeyStore};
use crate::state::AppState;
use crate::store::{Record, SqliteStore, VaultStore};
use crate::{biometrics, crypto, storage};
use tauri::{AppHandle, State};

// True when a vault exists in either form — the SQLite DB, or a legacy JSON
// vault that unlock will migrate on first open.
#[tauri::command]
pub fn is_initialized(app: AppHandle) -> Result<bool> {
    storage::ensure_migrated(&app);
    Ok(storage::db_exists(&app) || storage::vault_exists(&app))
}

// Create a brand-new, empty encrypted store protected by `password`.
#[tauri::command]
pub fn setup(password: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let secret = crypto::hash_secret(&password);
    let db_key = crypto::sqlcipher_key(&secret);
    let store = SqliteStore::open(&storage::db_path(&app)?, &db_key).map_err(store_err)?;
    store.meta_set("kdf", KDF_DESCRIPTOR).map_err(store_err)?;
    state.session.lock().unwrap().set(secret, store, false);
    Ok(())
}

// Unlock with the master password: derive the keys, open the store (migrating a
// legacy JSON vault on first open), and return the entry metadata list.
#[tauri::command]
pub fn unlock(
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    let secret = crypto::hash_secret(&password);
    let (store, entries) = open_and_load(&app, &secret)?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(secret, store, sync_configured);
    Ok(UnlockResult {
        entries,
        sync_configured,
    })
}

// Clear the in-memory key and close the store.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<()> {
    state.session.lock().unwrap().clear();
    Ok(())
}

// Unlock from a locked start using the biometric-gated key in the OS secure
// store. Retrieving the key triggers the biometric prompt; the key then opens
// the store (and migrates a legacy JSON vault if needed).
#[tauri::command]
pub fn unlock_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    if !storage::biometric_enrolled(&app) {
        return Err(Error::Other("biometric unlock is not enabled".into()));
    }
    let key = match secure_store::Platform.retrieve() {
        Ok(k) => k,
        Err(Error::NotFound) => {
            // The OS invalidated the item (e.g. enrolled fingerprints changed).
            // Clear the stale marker so we stop offering a broken affordance.
            let _ = storage::set_biometric_enrolled(&app, false);
            return Err(Error::NotFound);
        }
        Err(e) => return Err(e),
    };
    let secret = String::from_utf8(key.to_vec()).map_err(|e| Error::Crypto(e.to_string()))?;
    let (store, entries) = open_and_load(&app, &secret)?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(secret, store, sync_configured);
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
        let key = session.master_key.as_ref().ok_or(Error::Locked)?;
        secure_store::Platform.store(key)?;
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

// Re-encrypt every payload under the new key, then re-key the encrypted DB.
// Correct even if slow: touches every row once. Requires an unlocked session.
#[tauri::command]
pub fn change_master_password(
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let old_secret = crypto::hash_secret(&current);
    let new_secret = crypto::hash_secret(&new);
    let old_cryptor = crypto::Cryptor::new(&old_secret);
    let new_cryptor = crypto::Cryptor::new(&new_secret);
    let new_db_key = crypto::sqlcipher_key(&new_secret);

    let mut session = state.session.lock().unwrap();
    // Verify the current password matches the unlocked session.
    match session.master_key.as_deref() {
        Some(k) if k == old_secret.as_bytes() => {}
        Some(_) => return Err(Error::InvalidPassword),
        None => return Err(Error::Locked),
    }

    let store = session.store()?;
    // Re-seal every row's payload under the new key (timestamps + tombstones kept).
    let reencrypted: Vec<Record> = live_or_all(store)?
        .into_iter()
        .map(|r| reencrypt_record(r, &old_cryptor, &new_cryptor))
        .collect::<Result<_>>()?;
    store.import(&reencrypted).map_err(store_err)?;
    // Re-encrypt the DB file itself under the new SQLCipher key.
    store.rekey(&new_db_key).map_err(store_err)?;

    // Re-encrypt the Drive token file under the new key if present (sync parity).
    let token = storage::read_gdrive(&app).unwrap_or_default();
    if !token.is_empty() {
        if let Ok(plain) = old_cryptor.decrypt(&token) {
            storage::write_gdrive(&app, &new_cryptor.encrypt(&plain)?)?;
        }
    }

    // Swap in the new key for the live session.
    session.master_key = Some(zeroize::Zeroizing::new(new_secret.clone().into_bytes()));
    drop(session);

    // The biometric-stored key is now stale; re-store the new material or clear it.
    if storage::biometric_enrolled(&app)
        && secure_store::Platform.store(new_secret.as_bytes()).is_err()
    {
        let _ = secure_store::Platform.delete();
        let _ = storage::set_biometric_enrolled(&app, false);
    }
    Ok(())
}

// All records including tombstones (they carry payloads that must be re-keyed).
fn live_or_all(store: &SqliteStore) -> Result<Vec<Record>> {
    store.export_for_sync().map_err(store_err)
}

// Unseal a record's payload under the old key and re-seal it under the new one,
// preserving all metadata (id/kind/title/tags/url_host/timestamps/tombstone).
fn reencrypt_record(mut r: Record, old: &crypto::Cryptor, new: &crypto::Cryptor) -> Result<Record> {
    let blob = String::from_utf8(r.payload).map_err(|e| Error::Crypto(e.to_string()))?;
    let obscured: Entry = old.decrypt_data(&blob)?;
    let exposed = old.expose(&obscured)?;
    let reobscured = new.obscure(&exposed)?;
    r.payload = new.encrypt_data(&reobscured)?.into_bytes();
    Ok(r)
}
