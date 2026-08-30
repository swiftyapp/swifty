use crate::error::{Error, Result};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

// Copy text to the clipboard, optionally clearing it after `clear_after_ms`.
#[tauri::command]
pub fn copy_to_clipboard(app: AppHandle, value: String, clear_after_ms: Option<u64>) -> Result<()> {
    app.clipboard()
        .write_text(value)
        .map_err(|e| Error::Other(e.to_string()))?;

    if let Some(ms) = clear_after_ms {
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(ms));
            let _ = handle.clipboard().clear();
        });
    }
    Ok(())
}
