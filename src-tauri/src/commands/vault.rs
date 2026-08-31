use crate::error::{Error, Result};
use crate::models::{Entry, UnlockResult, VaultData};
use crate::state::AppState;
use crate::{crypto, storage};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

// Return the currently unlocked vault. Sensitive fields stay encrypted; the
// frontend reveals individual entries on demand (reveal_entry).
#[tauri::command]
pub fn read_vault(state: State<'_, AppState>) -> Result<VaultData> {
    state.session.lock().unwrap().vault.clone().ok_or(Error::Locked)
}

// Decrypt one entry's sensitive fields on demand (view/edit).
#[tauri::command]
pub fn reveal_entry(id: String, state: State<'_, AppState>) -> Result<Entry> {
    let session = state.session.lock().unwrap();
    let cryptor = session.cryptor()?;
    let vault = session.vault.as_ref().ok_or(Error::Locked)?;
    let entry = vault.entries.iter().find(|e| e.id == id).ok_or(Error::NotFound)?;
    cryptor.expose(entry)
}

// Persist entries. Only fields that changed vs. the held ciphertext are
// re-encrypted, so saving one edited entry doesn't re-derive keys for the vault.
#[tauri::command]
pub fn save_vault(
    entries: Vec<Entry>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultData> {
    let (cryptor, current) = {
        let s = state.session.lock().unwrap();
        (s.cryptor()?, s.vault.clone())
    };
    let previous = current.map(|v| v.entries).unwrap_or_default();
    let obscured: Vec<Entry> = entries
        .iter()
        .map(|e| cryptor.obscure_changed(e, previous.iter().find(|p| p.id == e.id)))
        .collect::<Result<_>>()?;
    let vault = VaultData { entries: obscured };
    storage::write_vault(&app, &cryptor.encrypt_data(&vault)?)?;
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
    // Validate it decrypts, then adopt it; fields stay encrypted (revealed lazily).
    let vault: VaultData = cryptor.decrypt_data(&blob).map_err(|_| Error::InvalidPassword)?;

    storage::write_vault(&app, &blob)?;
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
