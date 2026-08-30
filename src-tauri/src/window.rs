use crate::autolock;
use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";

// Build the main window from the frozen config, adding the per-OS chrome and
// navigation locking that tauri.conf.json can't express (config sets create:false).
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == MAIN)
        .expect("main window missing from tauri.conf.json")
        .clone();

    let handle = app.clone();
    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::from_config(app, &config)?
        .on_navigation(move |url| navigate(&handle, url));

    // Frameless on Windows; macOS keeps the hidden-inset title bar from config.
    #[cfg(target_os = "windows")]
    {
        builder = builder.decorations(false);
    }

    let window = builder.build()?;
    let handle = app.clone();
    window.on_window_event(move |event| autolock::handle_event(&handle, event));
    Ok(())
}

// Block in-app navigation to external sites; open them in the OS browser instead.
fn navigate(app: &AppHandle, url: &tauri::Url) -> bool {
    let external = matches!(url.scheme(), "http" | "https")
        && !matches!(url.host_str(), Some(h) if h == "localhost" || h.ends_with(".localhost"));
    if external {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
        return false;
    }
    true
}

// Show and focus the main window (tray "Open Swifty" and second-instance launch).
pub fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
