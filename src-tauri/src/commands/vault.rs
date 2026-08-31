use crate::commands::{list_metas, live_records, record_meta_dto, store_err};
use crate::error::{Error, Result};
use crate::models::{Entry, EntryMetaDto, UnlockResult, VaultData};
use crate::state::AppState;
use crate::store::{migrate, VaultStore};
use crate::{crypto, storage};
use std::fs;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

// The entry list: non-secret metadata only. Secrets stay encrypted in the store
// and are revealed one entry at a time (reveal_entry).
#[tauri::command]
pub fn read_vault(state: State<'_, AppState>) -> Result<Vec<EntryMetaDto>> {
    let session = state.session.lock().unwrap();
    list_metas(session.store()?)
}

// Decrypt one entry on demand (view/edit): fetch its payload, unseal it, then
// decrypt its per-field secrets. Nothing is cached in the session.
#[tauri::command]
pub fn reveal_entry(id: String, state: State<'_, AppState>) -> Result<Entry> {
    let session = state.session.lock().unwrap();
    let cryptor = session.cryptor()?;
    let record = session
        .store()?
        .get(&id)
        .map_err(store_err)?
        .ok_or(Error::NotFound)?;
    let blob = String::from_utf8(record.payload).map_err(|e| Error::Crypto(e.to_string()))?;
    let obscured: Entry = cryptor.decrypt_data(&blob)?;
    cryptor.expose(&obscured)
}

// Persist one entry: seal its secrets into a fresh payload and upsert a single
// row (metadata + payload), stamping updated_at. No whole-vault rewrite.
#[tauri::command]
pub fn save_entry(entry: Entry, state: State<'_, AppState>) -> Result<EntryMetaDto> {
    let session = state.session.lock().unwrap();
    let cryptor = session.cryptor()?;
    let store = session.store()?;

    let obscured = cryptor.obscure(&entry)?;
    let record = migrate::records_from_entries(&[obscured], &cryptor)?
        .into_iter()
        .next()
        .ok_or_else(|| Error::Other("record build failed".into()))?;
    store.upsert(&record).map_err(store_err)?;

    let saved = store
        .get(&record.id)
        .map_err(store_err)?
        .ok_or(Error::NotFound)?;
    Ok(record_meta_dto(&saved))
}

// Tombstone one entry (retained for sync); it drops out of the list.
#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<()> {
    let session = state.session.lock().unwrap();
    session.store()?.delete(&id).map_err(store_err)
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

// Restore a `.swftx` backup: decrypt it with `password`, import every entry into
// the store, and adopt it as the unlocked session.
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
    // Validate it decrypts before touching the store.
    let vault: VaultData = cryptor
        .decrypt_data(&blob)
        .map_err(|_| Error::InvalidPassword)?;

    let db_key = crypto::sqlcipher_key(&secret);
    let store =
        crate::store::SqliteStore::open(&storage::db_path(&app)?, &db_key).map_err(store_err)?;
    store
        .meta_set("kdf", crate::commands::KDF_DESCRIPTOR)
        .map_err(store_err)?;
    let records = migrate::records_from_entries(&vault.entries, &cryptor)?;
    store.import(&records).map_err(store_err)?;

    let metas = list_metas(&store)?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(secret, store, sync_configured);
    Ok(UnlockResult {
        entries: metas,
        sync_configured,
    })
}

// Export the vault to a user-chosen file. Reconstructs the legacy `.swftx` blob
// (obscured entries sealed under the master key) so backups stay restorable via
// import_backup. Returns the path, or None if cancelled.
#[tauri::command]
pub fn export_vault(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>> {
    let blob = {
        let session = state.session.lock().unwrap();
        let cryptor = session.cryptor()?;
        // Each payload already holds the obscured entry; unseal to rebuild VaultData.
        let entries = live_records(session.store()?)?
            .into_iter()
            .map(|r| {
                let s = String::from_utf8(r.payload).map_err(|e| Error::Crypto(e.to_string()))?;
                cryptor.decrypt_data::<Entry>(&s)
            })
            .collect::<Result<Vec<Entry>>>()?;
        cryptor.encrypt_data(&VaultData { entries })?
    };

    let dest = app
        .dialog()
        .file()
        .set_file_name("vault.swftx")
        .add_filter("Swifty backup", &["swftx"])
        .blocking_save_file();
    let Some(dest) = dest.and_then(|f| f.into_path().ok()) else {
        return Ok(None);
    };
    let dest = match dest.extension() {
        Some(e) if e == "swftx" => dest,
        _ => dest.with_extension("swftx"),
    };
    fs::write(&dest, blob)?;
    Ok(Some(dest.to_string_lossy().into_owned()))
}
