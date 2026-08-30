use crate::error::Result;
use crate::models::SyncStatus;
use crate::state::AppState;
use tauri::{AppHandle, State};

// Connect a sync provider (first push). Emits sync:connected on success.
#[tauri::command]
#[allow(unused_variables)]
pub fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    todo!("PR-8: configure provider, initial push, emit sync:connected")
}

// Disconnect the sync provider. Emits sync:disconnected.
#[tauri::command]
#[allow(unused_variables)]
pub fn sync_disconnect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    todo!("PR-8: drop provider credentials, emit sync:disconnected")
}

// Run a sync now. Emits sync:started then sync:stopped.
#[tauri::command]
#[allow(unused_variables)]
pub fn sync_now(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    todo!("PR-8: pull, merge, push; emit sync:started/sync:stopped")
}

// Import a remote vault into the local one. Emits vault:pull:started/stopped.
#[tauri::command]
#[allow(unused_variables)]
pub fn sync_import(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    todo!("PR-8: authenticate provider, pull remote vault, replace local")
}

#[tauri::command]
#[allow(unused_variables)]
pub fn sync_status(state: State<'_, AppState>) -> Result<SyncStatus> {
    // PR-8 reports real provider state; not configured until then.
    Ok(SyncStatus { configured: false })
}
