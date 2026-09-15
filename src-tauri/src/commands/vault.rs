use crate::app::APP_NAME;
use crate::commands::{derive_key, list_deleted_metas, list_metas, meta_dto_of, save, store_err};
use crate::error::{Error, Result};
use crate::models::{Entry, EntryMetaDto, VaultData};
use crate::state::AppState;
use crate::store::{migrate, Record, VaultStore};
use crate::{crypto, storage, sync};
use serde_json::json;
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

    meta_dto_of(store, &record.id)
}

// Tombstone one entry (retained for sync); it drops out of the list.
#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<()> {
    let session = state.session.lock().unwrap();
    session.store()?.delete(&id).map_err(store_err)
}

// The Trash: tombstoned entries' metadata, newest deletion first.
#[tauri::command]
pub fn list_deleted(state: State<'_, AppState>) -> Result<Vec<EntryMetaDto>> {
    let session = state.session.lock().unwrap();
    list_deleted_metas(session.store()?)
}

// Bring a tombstoned entry back; returns its refreshed metadata so the list can
// take it back without a re-read.
#[tauri::command]
pub fn restore_entry(id: String, state: State<'_, AppState>) -> Result<EntryMetaDto> {
    let session = state.session.lock().unwrap();
    let store = session.store()?;
    store.restore(&id).map_err(store_err)?;
    meta_dto_of(store, &id)
}

// Discard a tombstoned entry's contents for good. See `SqliteStore::purge` for
// why this empties the row rather than deleting it.
#[tauri::command]
pub fn purge_entry(id: String, state: State<'_, AppState>) -> Result<()> {
    let session = state.session.lock().unwrap();
    session.store()?.purge(&id).map_err(store_err)
}

// Star or unstar one entry. A metadata-only write: no payload is unsealed or
// re-sealed, so the star never risks the secret fields.
#[tauri::command]
pub fn set_favorite(
    id: String,
    favorite: bool,
    state: State<'_, AppState>,
) -> Result<EntryMetaDto> {
    let session = state.session.lock().unwrap();
    let store = session.store()?;
    store.set_favorite(&id, favorite).map_err(store_err)?;
    meta_dto_of(store, &id)
}

/// The backup file's extension, and the one the picker filters on. Also the
/// desktop file association in `tauri.conf.json`; keep the two in step.
pub const BACKUP_EXTENSION: &str = "rowel";

// Open a file picker for a `.rowel` backup. Returns the chosen path, or None if cancelled.
// The blocking picker must run off the main thread: a sync command runs on the
// main thread, and blocking there deadlocks the event loop (window hangs) while
// the modal waits for it. spawn_blocking moves the wait off-main; the plugin
// still presents the panel on the main thread internally.
#[tauri::command]
pub async fn pick_backup(app: AppHandle) -> Result<Option<String>> {
    let file = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter(format!("{APP_NAME} backup"), &[BACKUP_EXTENSION])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?;
    Ok(file
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
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

// Export the vault to a user-chosen `.rowel` file: the same pack the sync engine
// uploads (KDF descriptor + SQLCipher snapshot, see `sync::pack`), so a backup
// restores through `setup_restore_from_file` exactly as a Drive pack does. The
// snapshot is already sealed under the vault key; `password` is asked for only
// to prove the person exporting can open what they are about to carry away.
// Nothing is purged first — a backup keeps every tombstone the sync pack would
// have reclaimed.
#[tauri::command]
pub async fn export_vault(
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>> {
    let kdf_params_json = storage::read_kdf_sidecar(&app)?.ok_or_else(|| {
        Error::Other("this vault predates the key descriptor and cannot be backed up".into())
    })?;
    let scratch = storage::sync_scratch_dir(&app)?;
    let bytes = {
        let session = state.session.lock().unwrap();
        // Guard: the export key must match the unlocked vault.
        let key = session.key()?;
        if derive_key(&app, &password)?.sqlcipher_key() != key.sqlcipher_key() {
            return Err(Error::InvalidPassword);
        }
        sync::pack::pack_store(
            session.store()?,
            &key.sqlcipher_key(),
            &kdf_params_json,
            &scratch,
        )?
    };

    let dest = save::save_export(
        &app,
        &format!(
            "{APP_NAME} backup {}.{BACKUP_EXTENSION}",
            chrono::Local::now().format("%Y-%m-%d")
        ),
        &format!("{APP_NAME} backup"),
        bytes,
    )
    .await?;
    Ok(dest.map(|p| p.to_string_lossy().into_owned()))
}

// "Save as file…" on an env entry: hand the revealed `.env` back to disk under
// the name it came in with (or `.env`), owner-readable only. The body arrives
// from the frontend, which already holds it revealed, so nothing is unsealed
// here — and nothing is logged: the body is the entry's one secret. Desktop
// only; the frontend hides the action on mobile, where the picker cannot be
// told what permissions to write with.
#[tauri::command]
pub async fn save_env_file(
    file_name_suggestion: String,
    body: String,
    app: AppHandle,
) -> Result<Option<String>> {
    let suggestion = file_name_suggestion.trim();
    let file_name = if suggestion.is_empty() {
        ".env"
    } else {
        suggestion
    };
    #[cfg(desktop)]
    {
        let dest = save::save_private_text(&app, file_name, body).await?;
        Ok(dest.map(|p| p.to_string_lossy().into_owned()))
    }
    #[cfg(mobile)]
    {
        let _ = (file_name, body, app);
        Err(Error::Other("saving a file is a desktop action".into()))
    }
}
