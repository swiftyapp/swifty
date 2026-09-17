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
///
/// The gate is the *session the request came from*, not "some session is
/// unlocked": a lookup is several round trips, and the vault can lock — or
/// lock and reopen — while one is in flight. `favicon::fetch` asks again
/// before each request, so a lock mid-lookup ends it at the next step.
#[tauri::command]
pub async fn fetch_favicon(
    app: AppHandle,
    state: State<'_, AppState>,
    host: String,
) -> Result<Option<String>> {
    let epoch = {
        let session = state.session.lock().unwrap();
        if !session.is_unlocked() {
            return Ok(None);
        }
        session.epoch()
    };
    let same_session = || {
        let session = state.session.lock().unwrap();
        session.is_unlocked() && session.epoch() == epoch
    };
    favicon::fetch(&app, &host, same_session).await
}
