use crate::commands::expose_all;
use crate::error::{Error, Result};
use crate::models::{SyncStatus, VaultData};
use crate::state::AppState;
use crate::{storage, sync};
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

// Connect a sync provider (OAuth). Emits sync:connected on success.
#[tauri::command]
pub fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if !sync::ENABLED {
        return Ok(());
    }
    let cryptor = state.session.lock().unwrap().cryptor()?;
    sync::setup(&app, &cryptor)?;
    state.session.lock().unwrap().sync_configured = true;
    let _ = app.emit("sync:connected", ());
    Ok(())
}

// Disconnect the sync provider (keeps the refresh token, per legacy). Emits sync:disconnected.
#[tauri::command]
pub fn sync_disconnect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if !sync::ENABLED {
        return Ok(());
    }
    let cryptor = state.session.lock().unwrap().cryptor()?;
    sync::disconnect(&app, &cryptor)?;
    state.session.lock().unwrap().sync_configured = false;
    let _ = app.emit("sync:disconnected", ());
    Ok(())
}

// Run a sync now (pull, merge, push). Emits sync:started then sync:stopped.
#[tauri::command]
pub fn sync_now(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if !sync::ENABLED {
        return Ok(());
    }
    let _ = app.emit("sync:started", ());
    let result = perform(&app, &state);
    let _ = match &result {
        Ok(()) => app.emit("sync:stopped", json!({ "success": true })),
        Err(e) => app.emit("sync:stopped", json!({ "success": false, "error": e.to_string() })),
    };
    result
}

// perform(): ensure remote exists -> push local; else pull -> merge -> push.
fn perform(app: &AppHandle, state: &AppState) -> Result<()> {
    let cryptor = state.session.lock().unwrap().cryptor()?;
    if !sync::is_configured(app, &cryptor) {
        return Err(Error::SyncNotConfigured);
    }

    let local = storage::read_vault(app)?;
    let merged = if sync::remote_vault_exists(app, &cryptor)? {
        let remote = sync::pull(app, &cryptor)?;
        let merged = sync::merge::merge_data(&local, &remote, &cryptor)?;
        storage::write_vault(app, &merged)?;
        merged
    } else {
        local
    };
    sync::push(app, &cryptor, &merged)?;

    // Reflect the merged vault in the live session.
    let stored: VaultData = cryptor.decrypt_data(&merged)?;
    let exposed = expose_all(&cryptor, &stored.entries)?;
    state.session.lock().unwrap().vault = Some(VaultData { entries: exposed });
    Ok(())
}

// Connect, then replace the local vault with the remote one. Emits vault:pull:started/stopped.
#[tauri::command]
pub fn sync_import(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if !sync::ENABLED {
        return Ok(());
    }
    let cryptor = state.session.lock().unwrap().cryptor()?;
    sync::setup(&app, &cryptor)?;
    state.session.lock().unwrap().sync_configured = true;

    let _ = app.emit("vault:pull:started", ());
    let result = import_remote(&app, &state, &cryptor);
    let _ = match &result {
        Ok(vault) => app.emit("vault:pull:stopped", json!({ "success": true, "data": vault })),
        Err(e) => app.emit("vault:pull:stopped", json!({ "success": false, "error": e.to_string() })),
    };
    result.map(|_| ())
}

fn import_remote(
    app: &AppHandle,
    state: &AppState,
    cryptor: &crate::crypto::Cryptor,
) -> Result<VaultData> {
    let remote = sync::pull(app, cryptor)?;
    let stored: VaultData = cryptor
        .decrypt_data(&remote)
        .map_err(|_| Error::Crypto("Failed to decrypt remote vault file".into()))?;
    storage::write_vault(app, &remote)?;

    let vault = VaultData {
        entries: expose_all(cryptor, &stored.entries)?,
    };
    state.session.lock().unwrap().vault = Some(vault.clone());
    Ok(vault)
}

#[tauri::command]
pub fn sync_status(state: State<'_, AppState>) -> Result<SyncStatus> {
    Ok(SyncStatus {
        configured: sync::ENABLED && state.session.lock().unwrap().sync_configured,
    })
}
