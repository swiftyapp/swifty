//! The commands whose work lives outside `commands/`: image scanning and
//! favicon lookup. Each module owns its logic; this is only where the IPC
//! surface is declared.

use tauri::{AppHandle, State};

use crate::error::Result;
use crate::scan::ScanResult;
use crate::state::AppState;
use crate::{favicon, scan};

#[tauri::command]
pub async fn scan_image(path: String) -> Result<ScanResult> {
    scan::scan(path).await
}

/// The icon for a host the entry list is showing. Unlocked vaults only: the
/// hosts are vault data, and a locked app should be making no requests about
/// them — a webview that asks anyway gets "no icon", not an error, since the
/// list it was drawing is gone.
#[tauri::command]
pub async fn fetch_favicon(
    app: AppHandle,
    state: State<'_, AppState>,
    host: String,
) -> Result<Option<String>> {
    if !state.session.lock().unwrap().is_unlocked() {
        return Ok(None);
    }
    favicon::fetch(&app, &host).await
}
