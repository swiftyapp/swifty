use crate::error::Result;
use std::time::Duration;
use tauri::AppHandle;
// iOS neither writes through the plugin nor reads the pasteboard back.
#[cfg(not(target_os = "ios"))]
use tauri_plugin_clipboard_manager::ClipboardExt;

// Copy text to the clipboard, optionally clearing it after `clear_after_ms`.
//
// Secrets are written with the platform "concealed" markers so clipboard
// managers, history, and Universal/cloud clipboard skip them. The delayed
// clear is compare-before-clear: it only wipes the clipboard if it still holds
// the exact value we wrote, so a value the user copied afterwards is never lost.
#[tauri::command]
pub fn copy_to_clipboard(app: AppHandle, value: String, clear_after_ms: Option<u64>) -> Result<()> {
    let clear_after = clear_after_ms.map(Duration::from_millis);
    write_concealed(&app, &value, clear_after)?;

    // Not on iOS: the expiry set at write time is what clears the pasteboard
    // there, and it survives the app being suspended, which a timer thread does
    // not. Reading the pasteboard back to compare would also raise the iOS 16+
    // system paste banner over a value the user never asked to paste.
    #[cfg(not(target_os = "ios"))]
    if let Some(delay) = clear_after {
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(delay);
            let current = handle.clipboard().read_text().ok();
            if should_clear(&value, current.as_deref()) {
                let _ = handle.clipboard().clear();
            }
        });
    }
    Ok(())
}

// Only clear when the clipboard still holds exactly what we wrote. Nothing but
// the delayed-clear thread consults it, and iOS has no such thread.
#[cfg_attr(target_os = "ios", allow(dead_code))]
fn should_clear(written: &str, current: Option<&str>) -> bool {
    current == Some(written)
}

#[cfg(target_os = "macos")]
fn write_concealed(_app: &AppHandle, value: &str, _clear_after: Option<Duration>) -> Result<()> {
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
fn write_concealed(app: &AppHandle, value: &str, _clear_after: Option<Duration>) -> Result<()> {
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

// iOS has no "concealed" pasteboard type. What it does have is a per-write
// options dictionary: `LocalOnly` keeps the secret off Universal Clipboard (no
// other device ever sees it), and `ExpirationDate` has the system drop the item
// on its own, which is a stronger clear than a timer this process may never live
// to run.
#[cfg(target_os = "ios")]
fn write_concealed(_app: &AppHandle, value: &str, clear_after: Option<Duration>) -> Result<()> {
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSArray, NSDate, NSDictionary, NSNumber, NSString};
    use objc2_ui_kit::{
        UIPasteboard, UIPasteboardOption, UIPasteboardOptionExpirationDate,
        UIPasteboardOptionLocalOnly,
    };

    // public.utf8-plain-text is the UTI every iOS paste target reads text from.
    let uti = NSString::from_str("public.utf8-plain-text");
    let text = NSString::from_str(value);
    let text: &AnyObject = &text;
    let item = NSDictionary::from_slices(&[&*uti], &[text]);

    let local_only = NSNumber::numberWithBool(true);
    let mut keys: Vec<&UIPasteboardOption> = vec![unsafe { UIPasteboardOptionLocalOnly }];
    let mut values: Vec<&AnyObject> = vec![&local_only];
    // Bound outside the `if` so it outlives the borrow the dictionary takes.
    let expires = clear_after.map(|d| NSDate::dateWithTimeIntervalSinceNow(d.as_secs_f64()));
    if let Some(date) = &expires {
        keys.push(unsafe { UIPasteboardOptionExpirationDate });
        values.push(date);
    }

    unsafe {
        UIPasteboard::generalPasteboard().setItems_options(
            &NSArray::from_slice(&[&*item]),
            &NSDictionary::from_slices(&keys, &values),
        );
    }
    Ok(())
}

#[cfg(not(any(target_vendor = "apple", target_os = "windows")))]
fn write_concealed(app: &AppHandle, value: &str, _clear_after: Option<Duration>) -> Result<()> {
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
