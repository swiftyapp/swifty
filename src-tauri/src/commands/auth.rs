use crate::commands::{expose_all, obscure_all};
use crate::error::{Error, Result};
use crate::models::{UnlockResult, VaultData};
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

// Re-unlock within an active session, gated by a biometric prompt. The key is
// already in memory (parity with legacy Touch ID), so no password is needed.
#[tauri::command]
pub fn unlock_biometric(state: State<'_, AppState>) -> Result<UnlockResult> {
    biometrics::authenticate()?;
    let session = state.session.lock().unwrap();
    let vault = session.vault.clone().ok_or(Error::Locked)?;
    Ok(UnlockResult {
        vault,
        sync_configured: session.sync_configured,
    })
}

#[tauri::command]
pub fn is_biometric_available() -> Result<bool> {
    Ok(biometrics::is_available())
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

    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state.session.lock().unwrap().set(
        new_secret,
        VaultData { entries: exposed },
        sync_configured,
    );
    Ok(())
}
