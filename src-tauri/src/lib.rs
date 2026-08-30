mod commands;
pub mod crypto;
mod error;
mod models;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Desktop-only plugins.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                let _ = app;
            }))
            .plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
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
