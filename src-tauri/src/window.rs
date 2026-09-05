use crate::autolock;
use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";

// How long to wait for the first page load before showing the window anyway, so
// a webview that never finishes (dev server down, a throwing bundle) degrades to
// a blank window rather than no window at all.
const SHOW_FALLBACK: std::time::Duration = std::time::Duration::from_secs(3);

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

    // One-shot latch: whichever of the two reveal paths (page load, fallback
    // timer) wins, the other becomes a no-op, so a window the user has since
    // closed to the tray never pops back up on its own.
    let revealed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

    let handle = app.clone();
    let ready = app.clone();
    let ready_latch = revealed.clone();
    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::from_config(app, &config)?
        .on_navigation(move |url| navigate(&handle, url))
        // Config creates the window hidden: an empty window would otherwise sit
        // on screen through the whole bundle load, and with an overlay title bar
        // that reads as bare traffic lights floating over nothing. Reveal it once
        // the webview has painted the first frame instead.
        .on_page_load(move |_, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                reveal(&ready, &ready_latch);
            }
        });

    // Frameless on Windows; macOS keeps the hidden-inset title bar from config.
    #[cfg(target_os = "windows")]
    {
        builder = builder.decorations(false);
    }

    let window = builder.build()?;
    let handle = app.clone();
    window.on_window_event(move |event| autolock::handle_event(&handle, event));

    let fallback = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(SHOW_FALLBACK);
        reveal(&fallback, &revealed);
    });

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

// First reveal at startup, run at most once (see the latch in `create`).
fn reveal(app: &AppHandle, revealed: &std::sync::atomic::AtomicBool) {
    if !revealed.swap(true, std::sync::atomic::Ordering::SeqCst) {
        show(app);
    }
}

// Show and focus the main window (tray "Open Swifty" and second-instance launch).
pub fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.show();
        // Minimization is a desktop window state; the API doesn't exist on mobile.
        #[cfg(desktop)]
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
