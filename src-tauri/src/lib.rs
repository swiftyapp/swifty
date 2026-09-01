mod autolock;
mod biometrics;
mod cards;
mod commands;
pub mod crypto;
mod error;
mod favicon;
mod hibp;
mod import;
mod models;
mod secure_store;
mod state;
mod storage;
pub mod store;
mod sync;
mod tray;
mod window;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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

    // In-app W3C WebDriver server (port 4445) for the E2E smoke suite. Never
    // compiled into a release binary.
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_webdriver::init());
    }

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
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
            tray::create(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::is_initialized,
            commands::auth::setup,
            commands::auth::unlock,
            commands::auth::lock,
            commands::auth::unlock_biometric,
            commands::auth::is_biometric_available,
            commands::auth::enable_biometric,
            commands::auth::disable_biometric,
            commands::auth::change_master_password,
            commands::vault::read_vault,
            commands::vault::reveal_entry,
            commands::vault::save_entry,
            commands::vault::delete_entry,
            commands::vault::pick_backup,
            commands::vault::import_backup,
            commands::vault::import_swftx,
            commands::vault::export_vault,
            commands::import::pick_import_file,
            commands::import::import_entries,
            commands::import::export_entries,
            commands::generator::generate_password,
            commands::generator::generate_otp,
            commands::generator::verify_otp,
            commands::audit::get_audit,
            favicon::fetch_favicon,
            commands::clipboard::copy_to_clipboard,
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
