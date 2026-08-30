use crate::commands::{expose_all, obscure_all};
use crate::error::{Error, Result};
use crate::models::{Entry, UnlockResult, VaultData};
use crate::state::AppState;
use crate::{crypto, storage};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

// Return the currently unlocked vault, decrypted.
#[tauri::command]
pub fn read_vault(state: State<'_, AppState>) -> Result<VaultData> {
    state.session.lock().unwrap().vault.clone().ok_or(Error::Locked)
}

// Persist plaintext entries; Rust encrypts and writes. Returns the saved vault.
#[tauri::command]
pub fn save_vault(
    entries: Vec<Entry>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultData> {
    let cryptor = state.session.lock().unwrap().cryptor()?;
    let obscured = VaultData {
        entries: obscure_all(&cryptor, &entries)?,
    };
    storage::write_vault(&app, &cryptor.encrypt_data(&obscured)?)?;
    let vault = VaultData { entries };
    state.session.lock().unwrap().vault = Some(vault.clone());
    Ok(vault)
}

// Open a file picker for a `.swftx` backup. Returns the chosen path, or None if cancelled.
#[tauri::command]
pub fn pick_backup(app: AppHandle) -> Result<Option<String>> {
    let file = app
        .dialog()
        .file()
        .add_filter("Swifty backup", &["swftx"])
        .blocking_pick_file();
    Ok(file
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
}

// Import a backup file, decrypting it with `password`, and adopt it as the vault.
#[tauri::command]
pub fn import_backup(
    path: String,
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    let blob = storage::read_backup(&path)?;
    let secret = crypto::hash_secret(&password);
    let cryptor = crypto::Cryptor::new(&secret);
    let stored: VaultData = cryptor.decrypt_data(&blob).map_err(|_| Error::InvalidPassword)?;

    storage::write_vault(&app, &blob)?;
    let vault = VaultData {
        entries: expose_all(&cryptor, &stored.entries)?,
    };
    let sync_configured = storage::sync_configured(&app);
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

// Export the vault to a file chosen via a save dialog. Returns the path, or None if cancelled.
#[tauri::command]
pub fn export_vault(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>> {
    if !state.session.lock().unwrap().is_unlocked() {
        return Err(Error::Locked);
    }
    let dest = app
        .dialog()
        .file()
        .set_file_name("vault.swftx")
        .add_filter("Swifty backup", &["swftx"])
        .blocking_save_file();
    let Some(dest) = dest.and_then(|f| f.into_path().ok()) else {
        return Ok(None);
    };
    let saved = storage::export_vault(&app, dest)?;
    Ok(Some(saved.to_string_lossy().into_owned()))
}
