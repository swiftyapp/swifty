use crate::error::Result;
use crate::models::UnlockResult;
use crate::state::AppState;
use tauri::{AppHandle, State};

// Create a brand-new vault protected by `password`.
#[tauri::command]
#[allow(unused_variables)]
pub fn setup(password: String, state: State<'_, AppState>) -> Result<()> {
    todo!("PR-3: derive key, create empty encrypted vault")
}

// Unlock the vault with the master password. Returns decrypted data for display;
// the derived key stays in Rust.
#[tauri::command]
#[allow(unused_variables)]
pub fn unlock(password: String, state: State<'_, AppState>) -> Result<UnlockResult> {
    todo!("PR-3: verify password, decrypt vault, hold key in session")
}

// Clear the in-memory key and lock the vault.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<()> {
    state.session.lock().unwrap().master_key = None;
    Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
pub fn unlock_biometric(state: State<'_, AppState>) -> Result<UnlockResult> {
    todo!("PR-3: unlock via stored key gated by biometric prompt")
}

#[tauri::command]
pub fn is_biometric_available() -> Result<bool> {
    // PR-5 wires the real platform check; false keeps the flow working until then.
    Ok(false)
}

#[tauri::command]
#[allow(unused_variables)]
pub fn change_master_password(
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    todo!("PR-3: re-encrypt vault under new key, re-push to sync")
}
