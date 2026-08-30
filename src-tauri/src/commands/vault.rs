use crate::error::Result;
use crate::models::{Entry, UnlockResult, VaultData};
use crate::state::AppState;
use tauri::{AppHandle, State};

// Return the currently unlocked vault, decrypted.
#[tauri::command]
#[allow(unused_variables)]
pub fn read_vault(state: State<'_, AppState>) -> Result<VaultData> {
    todo!("PR-4: decrypt and return current vault")
}

// Persist plaintext entries; Rust encrypts and writes. Returns the saved vault.
#[tauri::command]
#[allow(unused_variables)]
pub fn save_vault(
    entries: Vec<Entry>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultData> {
    todo!("PR-4: encrypt entries, write vault, emit audit:done")
}

// Open a file picker for a `.swftx` backup. Returns the chosen path, or None if cancelled.
#[tauri::command]
#[allow(unused_variables)]
pub fn pick_backup(app: AppHandle) -> Result<Option<String>> {
    todo!("PR-4: show open dialog for backup file")
}

// Import a backup file, decrypting it with `password`.
#[tauri::command]
#[allow(unused_variables)]
pub fn import_backup(
    path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    todo!("PR-4: decrypt backup, replace vault, unlock")
}

// Export the vault to a file chosen via a save dialog. Returns the path, or None if cancelled.
#[tauri::command]
#[allow(unused_variables)]
pub fn export_vault(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>> {
    todo!("PR-4: show save dialog, export encrypted vault")
}
