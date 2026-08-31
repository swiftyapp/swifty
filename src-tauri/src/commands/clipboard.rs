use crate::error::Result;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

// Copy text to the clipboard, optionally clearing it after `clear_after_ms`.
//
// Secrets are written with the platform "concealed" markers so clipboard
// managers, history, and Universal/cloud clipboard skip them. The delayed
// clear is compare-before-clear: it only wipes the clipboard if it still holds
// the exact value we wrote, so a value the user copied afterwards is never lost.
#[tauri::command]
pub fn copy_to_clipboard(app: AppHandle, value: String, clear_after_ms: Option<u64>) -> Result<()> {
    write_concealed(&app, &value)?;

    if let Some(ms) = clear_after_ms {
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(ms));
            let current = handle.clipboard().read_text().ok();
            if should_clear(&value, current.as_deref()) {
                let _ = handle.clipboard().clear();
            }
        });
    }
    Ok(())
}

// Only clear when the clipboard still holds exactly what we wrote.
fn should_clear(written: &str, current: Option<&str>) -> bool {
    current == Some(written)
}

#[cfg(target_os = "macos")]
fn write_concealed(_app: &AppHandle, value: &str) -> Result<()> {
    use objc2_app_kit::NSPasteboard;
    use objc2_foundation::{NSArray, NSString};

    // public.utf8-plain-text == NSPasteboardTypeString.
    let text_type = NSString::from_str("public.utf8-plain-text");
    let concealed_type = NSString::from_str("org.nspasteboard.ConcealedType");
    let text = NSString::from_str(value);

    unsafe {
        let pb = NSPasteboard::generalPasteboard();
        pb.clearContents();
        let types = NSArray::from_slice(&[&*text_type, &*concealed_type]);
        pb.declareTypes_owner(&types, None);
        pb.setString_forType(&text, &text_type);
        pb.setString_forType(&text, &concealed_type);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn write_concealed(app: &AppHandle, value: &str) -> Result<()> {
    // Fall back to a plain write if the native path can't take the clipboard.
    if write_windows(value).is_err() {
        app.clipboard()
            .write_text(value.to_string())
            .map_err(|e| crate::error::Error::Other(e.to_string()))?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn write_windows(value: &str) -> Result<()> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{HANDLE, HGLOBAL};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    const CF_UNICODETEXT: u32 = 13;
    // Markers that opt the secret out of history, cloud sync, and monitoring.
    const EXCLUSIONS: [&str; 3] = [
        "ExcludeClipboardContentFromMonitorProcessing",
        "CanIncludeInClipboardHistory",
        "CanUploadToCloudClipboard",
    ];

    unsafe fn global_from_bytes(bytes: &[u8]) -> Option<HGLOBAL> {
        let handle = GlobalAlloc(GMEM_MOVEABLE, bytes.len()).ok()?;
        let ptr = GlobalLock(handle);
        if ptr.is_null() {
            return None;
        }
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr as *mut u8, bytes.len());
        let _ = GlobalUnlock(handle);
        Some(handle)
    }

    unsafe {
        OpenClipboard(None).map_err(|e| crate::error::Error::Other(e.to_string()))?;
        let _ = EmptyClipboard();

        let mut utf16: Vec<u16> = value.encode_utf16().collect();
        utf16.push(0);
        let text_bytes: Vec<u8> = utf16.iter().flat_map(|u| u.to_ne_bytes()).collect();
        if let Some(handle) = global_from_bytes(&text_bytes) {
            let _ = SetClipboardData(CF_UNICODETEXT, Some(HANDLE(handle.0)));
        }

        for name in EXCLUSIONS {
            let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
            let format = RegisterClipboardFormatW(PCWSTR(wide.as_ptr()));
            if format != 0 {
                if let Some(handle) = global_from_bytes(&0u32.to_ne_bytes()) {
                    let _ = SetClipboardData(format, Some(HANDLE(handle.0)));
                }
            }
        }

        let _ = CloseClipboard();
    }
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn write_concealed(app: &AppHandle, value: &str) -> Result<()> {
    app.clipboard()
        .write_text(value.to_string())
        .map_err(|e| crate::error::Error::Other(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::should_clear;

    #[test]
    fn clears_only_when_value_unchanged() {
        assert!(should_clear("secret", Some("secret")));
    }

    #[test]
    fn keeps_a_value_the_user_copied_afterwards() {
        assert!(!should_clear("secret", Some("something else")));
    }

    #[test]
    fn keeps_an_empty_or_unreadable_clipboard() {
        assert!(!should_clear("secret", None));
        assert!(!should_clear("secret", Some("")));
    }
}
