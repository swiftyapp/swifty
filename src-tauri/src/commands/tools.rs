//! The commands whose work lives outside `commands/`: image scanning, favicon
//! lookup and the auto-lock timeout. Each module owns its logic; this is only
//! where the IPC surface is declared.

use tauri::AppHandle;

use crate::error::Result;
use crate::scan::ScanResult;
use crate::{autolock, favicon, scan};

#[tauri::command]
pub async fn scan_image(path: String) -> Result<ScanResult> {
    scan::scan(path).await
}

#[tauri::command]
pub async fn fetch_favicon(app: AppHandle, host: String) -> Result<Option<String>> {
    favicon::fetch(&app, &host).await
}

#[tauri::command]
pub fn set_autolock_timeout(app: AppHandle, secs: u64) -> Result<()> {
    autolock::set_timeout(&app, secs);
    Ok(())
}
