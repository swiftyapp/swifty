mod app;
mod autolock;
mod biometrics;
mod cards;
mod commands;
pub mod crypto;
mod error;
mod favicon;
mod hibp;
mod import;
mod locale;
mod models;
// The WebAuthn authenticator core. Declared only: its caller is the browser
// extension host a later PR adds, so no command is registered below yet.
mod passkey;
// Local image scanning (card / identity document). `pub` so `examples/scan.rs`
// can drive the OCR backend without the app around it.
pub mod scan;
mod secure_store;
mod state;
mod storage;
pub mod store;
mod sync;
mod timer;
// `tauri::tray` and `tauri::menu` are desktop-only.
#[cfg(desktop)]
mod tray;
mod window;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Only the desktop-gated blocks below reassign it.
    #[cfg_attr(mobile, allow(unused_mut))]
    let mut builder = tauri::Builder::default();

    // Desktop-only plugins.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                window::show(app); // focus existing window on a second launch
            }))
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    // Mobile-only plugins.
    #[cfg(mobile)]
    {
        // The OAuth redirect for the public mobile client arrives on the app's
        // own URL scheme (see `tauri.ios.conf.json`), not on a loopback port.
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    // In-app W3C WebDriver server (port 4445) for the E2E smoke suite. Never
    // compiled into a release binary, and desktop-only — the suite drives the
    // desktop app.
    #[cfg(all(debug_assertions, desktop))]
    {
        builder = builder.plugin(tauri_plugin_webdriver::init());
    }

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            // The plugin defaults to Trace, which pulls in every dependency's
            // tracing -- tao logs entry and exit of each NSWindowDelegate
            // callback, so ordinary focus changes flood stderr and the log file.
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("swifty_lib", log::LevelFilter::Debug)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stderr,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: None },
                ))
                .build(),
        )
        .manage(AppState::default())
        .manage(autolock::AutoLock::default())
        .setup(|app| {
            storage::ensure_migrated(app.handle()); // one-time copy from the legacy Electron vault
            window::create(app.handle())?;
            #[cfg(desktop)]
            tray::create(app.handle())?;
            // The second half of the mobile OAuth flow: iOS reopens the app
            // with Google's redirect once the user has approved.
            #[cfg(mobile)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        commands::sync::on_redirect(&handle, &url);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::is_initialized,
            commands::auth::setup,
            commands::auth::unlock,
            commands::auth::lock,
            commands::auth::unlock_biometric,
            commands::auth::is_biometric_available,
            commands::auth::biometric_status,
            commands::auth::enable_biometric,
            commands::auth::disable_biometric,
            commands::auth::change_master_password,
            commands::vault::read_vault,
            commands::vault::reveal_entry,
            commands::vault::save_entry,
            commands::vault::delete_entry,
            commands::vault::list_deleted,
            commands::vault::restore_entry,
            commands::vault::purge_entry,
            commands::vault::set_favorite,
            commands::vault::pick_backup,
            commands::vault::import_backup,
            commands::vault::import_swftx,
            commands::vault::export_vault,
            commands::import::pick_import_file,
            commands::import::import_entries,
            commands::import::export_entries,
            commands::generator::generate_password,
            commands::generator::generate_ssh_key,
            commands::generator::generate_otp,
            commands::generator::verify_otp,
            commands::audit::get_audit,
            scan::scan_image,
            scan::scan_supported,
            favicon::fetch_favicon,
            commands::clipboard::copy_to_clipboard,
            autolock::set_autolock_timeout,
            locale::os_locale,
            commands::sync::sync_connect,
            commands::sync::sync_disconnect,
            commands::sync::sync_now,
            commands::sync::sync_import,
            commands::sync::sync_status,
            // E2E-only vault reset. `generate_handler!` honours per-command
            // attributes, so in a release build the match arm — and with it the
            // only reference to the (also cfg'd-out) module — simply is not
            // generated. See `commands/e2e.rs` for the runtime gates.
            #[cfg(debug_assertions)]
            commands::e2e::e2e_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
