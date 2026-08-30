mod autolock;
mod biometrics;
mod commands;
pub mod crypto;
mod error;
mod models;
mod state;
mod storage;
mod sync;
mod tray;
#[cfg(desktop)]
mod updater;
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
            .plugin(tauri_plugin_updater::Builder::new().build());
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
            #[cfg(desktop)]
            updater::check(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::is_initialized,
            commands::auth::setup,
            commands::auth::unlock,
            commands::auth::lock,
            commands::auth::unlock_biometric,
            commands::auth::is_biometric_available,
            commands::auth::change_master_password,
            commands::vault::read_vault,
            commands::vault::save_vault,
            commands::vault::pick_backup,
            commands::vault::import_backup,
            commands::vault::export_vault,
            commands::generator::generate_password,
            commands::generator::generate_otp,
            commands::generator::verify_otp,
            commands::audit::get_audit,
            commands::clipboard::copy_to_clipboard,
            commands::sync::sync_connect,
            commands::sync::sync_disconnect,
            commands::sync::sync_now,
            commands::sync::sync_import,
            commands::sync::sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
