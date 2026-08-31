use crate::commands::{
    create_vault, derive_key, list_metas, live_records, record_meta_dto, store_err,
};
use crate::error::{Error, Result};
use crate::models::{Entry, EntryMetaDto, UnlockResult, VaultData};
use crate::state::AppState;
use crate::store::{migrate, Record, VaultStore};
use crate::{crypto, storage};
use serde_json::json;
use std::fs;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

// The entry list: non-secret metadata only. Secrets stay encrypted in the store
// and are revealed one entry at a time (reveal_entry).
#[tauri::command]
pub fn read_vault(state: State<'_, AppState>) -> Result<Vec<EntryMetaDto>> {
    let session = state.session.lock().unwrap();
    list_metas(session.store()?)
}

// Decrypt one entry on demand (view/edit): fetch its payload and unseal it with
// the session payload key. Nothing is cached in the session.
#[tauri::command]
pub fn reveal_entry(id: String, state: State<'_, AppState>) -> Result<Entry> {
    let session = state.session.lock().unwrap();
    let cipher = session.payload_cipher()?;
    let record = session
        .store()?
        .get(&id)
        .map_err(store_err)?
        .ok_or(Error::NotFound)?;
    cipher.unseal(&record.payload)
}

// Persist one entry: seal it into a fresh payload and upsert a single row
// (metadata + payload), stamping updated_at. No whole-vault rewrite.
#[tauri::command]
pub fn save_entry(entry: Entry, state: State<'_, AppState>) -> Result<EntryMetaDto> {
    let session = state.session.lock().unwrap();
    let cipher = session.payload_cipher()?;
    let store = session.store()?;

    let payload = cipher.seal(&entry)?;
    let record = migrate::build_record(&entry, payload)?;
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
// The blocking picker must run off the main thread: a sync command runs on the
// main thread, and blocking there deadlocks the event loop (window hangs) while
// the modal waits for it. spawn_blocking moves the wait off-main; the plugin
// still presents the panel on the main thread internally.
#[tauri::command]
pub async fn pick_backup(app: AppHandle) -> Result<Option<String>> {
    let file = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Swifty backup", &["swftx"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?;
    Ok(file
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
}

// Restore a `.swftx` backup: decrypt it with `password` (legacy format), create a
// fresh Argon2id vault under the same password, re-seal every entry under the new
// payload key, and adopt it as the unlocked session.
#[tauri::command]
pub fn import_backup(
    path: String,
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    let blob = storage::read_backup(&path)?;
    let src_cryptor = crypto::Cryptor::new(&crypto::hash_secret(&password));
    // Validate it decrypts before touching the store.
    let vault: VaultData = src_cryptor
        .decrypt_data(&blob)
        .map_err(|_| Error::InvalidPassword)?;

    let (key, store) = create_vault(&app, &password)?;
    let records = migrate::reseal_swftx(&vault.entries, &src_cryptor, &key.payload_cipher())?;
    store.import(&records).map_err(store_err)?;

    let metas = list_metas(&store)?;
    let sync_configured = crate::sync::ENABLED && storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(key, store, sync_configured);
    Ok(UnlockResult {
        entries: metas,
        sync_configured,
    })
}

// Import a `.swftx` backup into the *currently unlocked* vault. The file is
// independently encrypted and carries its own master password (which may differ
// from the current vault's). Each entry is decrypted under the source key and
// re-sealed under the current session payload key, then upserted (merge/add by
// id). The CPU-bound re-seal loop runs off the UI thread and emits `import:progress`.
#[tauri::command]
pub async fn import_swftx(
    path: String,
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<usize> {
    let blob = storage::read_backup(&path)?;
    let src_cryptor = crypto::Cryptor::new(&crypto::hash_secret(&password));
    // Validate the source password before touching the store.
    let src: VaultData = src_cryptor
        .decrypt_data(&blob)
        .map_err(|_| Error::InvalidPassword)?;
    let cur_cipher = state.session.lock().unwrap().payload_cipher()?;

    // Re-seal every entry off the UI thread: expose under the source key, re-seal
    // under the current payload key — emitting progress as it goes.
    let emitter = app.clone();
    let records = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<Record>> {
        let total = src.entries.len();
        let mut records = Vec::with_capacity(total);
        for (i, obscured) in src.entries.iter().enumerate() {
            records.push(migrate::reseal_one(obscured, &src_cryptor, &cur_cipher)?);
            let _ = emitter.emit("import:progress", json!({ "done": i + 1, "total": total }));
        }
        Ok(records)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))??;

    // Merge into the open store (upsert by id).
    {
        let session = state.session.lock().unwrap();
        let store = session.store()?;
        for record in &records {
            store.upsert(record).map_err(store_err)?;
        }
    }
    let count = records.len();
    let _ = app.emit("import:done", json!({ "count": count }));
    Ok(count)
}

// Export the vault to a user-chosen file. Reconstructs the legacy `.swftx` blob
// (entries obscured + sealed under `hash_secret(password)`) so backups stay
// restorable via import_backup on any install. `password` must be the current
// master password; a mismatch is rejected so a backup is never unrecoverable.
#[tauri::command]
pub async fn export_vault(
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>> {
    let blob = {
        let session = state.session.lock().unwrap();
        // Guard: the export key must match the unlocked vault.
        if derive_key(&app, &password)?.sqlcipher_key() != session.key()?.sqlcipher_key() {
            return Err(Error::InvalidPassword);
        }
        let cipher = session.payload_cipher()?;
        // Rebuild each plaintext entry from its stored payload, then obscure + seal
        // under the legacy password-derived cryptor for a portable `.swftx`.
        let out = crypto::Cryptor::new(&crypto::hash_secret(&password));
        let entries = live_records(session.store()?)?
            .into_iter()
            .map(|r| out.obscure(&cipher.unseal(&r.payload)?))
            .collect::<Result<Vec<Entry>>>()?;
        out.encrypt_data(&VaultData { entries })?
    };

    // Off-main-thread so the blocking save dialog can't deadlock the event loop.
    let dest = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_file_name("vault.swftx")
            .add_filter("Swifty backup", &["swftx"])
            .blocking_save_file()
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?;
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
