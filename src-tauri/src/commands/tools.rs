//! The commands whose work lives outside `commands/`: image scanning and
//! favicon lookup. Each module owns its logic; this is only where the IPC
//! surface is declared.

use tauri::AppHandle;

use crate::error::Result;
use crate::scan::ScanResult;
use crate::{favicon, scan};

#[tauri::command]
pub async fn scan_image(path: String) -> Result<ScanResult> {
    scan::scan(path).await
}

#[tauri::command]
pub async fn fetch_favicon(app: AppHandle, host: String) -> Result<Option<String>> {
    favicon::fetch(&app, &host).await
}
