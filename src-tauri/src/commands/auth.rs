use crate::commands::{expose_all, obscure_all};
use crate::error::{Error, Result};
use crate::models::{UnlockResult, VaultData};
use crate::secure_store::{self, KeyStore};
use crate::state::AppState;
use crate::{biometrics, crypto, storage};
use tauri::{AppHandle, State};

// Create a brand-new vault protected by `password`.
#[tauri::command]
pub fn is_initialized(app: AppHandle) -> Result<bool> {
    storage::ensure_migrated(&app);
    Ok(storage::vault_exists(&app))
}

#[tauri::command]
pub fn setup(password: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let secret = crypto::hash_secret(&password);
    let cryptor = crypto::Cryptor::new(&secret);
    let vault = VaultData { entries: vec![] };
    storage::write_vault(&app, &cryptor.encrypt_data(&vault)?)?;
    state.session.lock().unwrap().set(secret, vault, false);
    Ok(())
}

// Unlock the vault with the master password. Returns decrypted data for display;
// the derived key stays in Rust.
#[tauri::command]
pub fn unlock(password: String, app: AppHandle, state: State<'_, AppState>) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    let blob = storage::read_vault(&app)?;
    let secret = crypto::hash_secret(&password);
    let cryptor = crypto::Cryptor::new(&secret);
    // One derivation decrypts the outer blob. Sensitive fields stay encrypted and
    // are exposed lazily (reveal_entry) so plaintext secrets aren't all in memory.
    let vault: VaultData = cryptor.decrypt_data(&blob).map_err(|_| Error::InvalidPassword)?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(secret, vault.clone(), sync_configured);
    Ok(UnlockResult {
        vault,
        sync_configured,
    })
}

// Clear the in-memory key and lock the vault.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<()> {
    state.session.lock().unwrap().clear();
    Ok(())
}

// Unlock from a fresh/locked start using the biometric-gated key in the OS
// secure store. Retrieving the key triggers the biometric prompt (Touch ID /
// Windows Hello); the key then rebuilds the Cryptor and decrypts the on-disk
// vault. Works even when nothing is in memory (app just launched).
#[tauri::command]
pub fn unlock_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    if !storage::biometric_enrolled(&app) {
        return Err(Error::Other("biometric unlock is not enabled".into()));
    }
    let blob = storage::read_vault(&app)?;
    let (key, vault) = match secure_store::open_vault(&secure_store::Platform, &blob) {
        Ok(v) => v,
        Err(Error::NotFound) => {
            // The OS invalidated the item (e.g. enrolled fingerprints changed).
            // Clear the stale marker so we stop offering a broken affordance.
            let _ = storage::set_biometric_enrolled(&app, false);
            return Err(Error::NotFound);
        }
        Err(e) => return Err(e),
    };
    // `open_vault` already validated the key as UTF-8 while decrypting.
    let secret = String::from_utf8(key.to_vec()).map_err(|e| Error::Crypto(e.to_string()))?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(secret, vault.clone(), sync_configured);
    Ok(UnlockResult {
        vault,
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

#[tauri::command]
pub fn change_master_password(
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let current_cryptor = crypto::Cryptor::new(&crypto::hash_secret(&current));
    let blob = storage::read_vault(&app)?;
    let stored: VaultData = current_cryptor
        .decrypt_data(&blob)
        .map_err(|_| Error::InvalidPassword)?;

    let new_secret = crypto::hash_secret(&new);
    let new_cryptor = crypto::Cryptor::new(&new_secret);

    // Expose under the old key, re-obscure under the new one.
    let exposed = expose_all(&current_cryptor, &stored.entries)?;
    let reobscured = VaultData {
        entries: obscure_all(&new_cryptor, &exposed)?,
    };
    let new_blob = new_cryptor.encrypt_data(&reobscured)?;
    storage::write_vault(&app, &new_blob)?;

    // Re-encrypt the Drive token file under the new key if present.
    let token = storage::read_gdrive(&app).unwrap_or_default();
    if !token.is_empty() {
        if let Ok(plain) = current_cryptor.decrypt(&token) {
            storage::write_gdrive(&app, &new_cryptor.encrypt(&plain)?)?;
        }
    }

    // Push the re-encrypted vault so the remote matches the new key (parity with
    // legacy). Best-effort: a re-key must still succeed offline.
    if crate::sync::ENABLED && crate::sync::is_configured(&app, &new_cryptor) {
        let _ = crate::sync::push(&app, &new_cryptor, &new_blob);
    }

    // The biometric-stored key is now stale (it unlocks the old blob). Re-store
    // the new material so biometric unlock keeps working; if that fails, clear it
    // rather than leave a key that unlocks nothing.
    if storage::biometric_enrolled(&app)
        && secure_store::Platform.store(new_secret.as_bytes()).is_err()
    {
        let _ = secure_store::Platform.delete();
        let _ = storage::set_biometric_enrolled(&app, false);
    }

    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state.session.lock().unwrap().set(
        new_secret,
        VaultData { entries: exposed },
        sync_configured,
    );
    Ok(())
}
