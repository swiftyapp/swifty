use crate::app::APP_NAME;
use crate::{autolock, window};
use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const WEBSITE: &str = "https://getswifty.pro";

// Tray menu mirrors legacy tray/index.js.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("show", format!("Open {APP_NAME}"))
        .text("lock", "Lock vault")
        .separator()
        .text("about", "About")
        .separator()
        .text("quit", "Quit")
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip(APP_NAME)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => window::show(app),
            "lock" => autolock::lock(app),
            "about" => {
                let _ = app.opener().open_url(WEBSITE, None::<&str>);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}
