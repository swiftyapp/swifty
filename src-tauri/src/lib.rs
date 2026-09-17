mod app;
// The master-password domain: the failed-unlock backoff and the rekey saga.
mod auth;
mod autolock;
mod biometrics;
mod cards;
mod commands;
pub mod crypto;
mod error;
mod events;
mod favicon;
mod hibp;
mod import;
mod locale;
mod models;
// How a stored `otp` value is spelled — read by the generator, the importers
// and the exporters alike, so it sits below all three.
mod otp;
// Owner-only file permissions, on Unix and Windows alike.
mod owner_only;
// The WebAuthn authenticator core. Declared only: its caller is the browser
// extension host a later PR adds, so no command is registered below yet.
mod passkey;
mod save;
// Local image scanning (card / identity document). `pub` so `examples/scan.rs`
// can drive the OCR backend without the app around it.
pub mod scan;
mod secure_store;
mod session;
mod settings;
mod share;
mod state;
mod storage;
pub mod store;
mod sync;
mod timer;
// `tauri::tray` and `tauri::menu` are desktop-only.
#[cfg(desktop)]
mod tray;
mod window;
// The optional additional vaults, and which of them the app is addressing.
mod workspace;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Before anything else: on mobile Tauri builds a reqwest client while
    // launching, and with `rustls-no-provider` that aborts the process unless
    // a provider is already installed (see `sync::install_crypto_provider`).
    sync::install_crypto_provider();

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

    // The timer behind the delayed clipboard clear. Not on iOS, where the
    // pasteboard's own expiry does the clearing and no timer is armed (see
    // `commands::clipboard`).
    #[cfg(not(target_os = "ios"))]
    {
        builder = builder.manage(commands::clipboard::ClipboardClear::default());
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
                .level_for("rowel_lib", log::LevelFilter::Debug)
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
        .manage(settings::SettingsState::default())
        .setup(|app| {
            // Preferences first: the shell and the auto-lock both open on them.
            settings::boot(app.handle());
            // Which workspace was open last. Read before the window exists, so
            // the lock screen the user lands on is that workspace's.
            let registry = workspace::Registry::load(&storage::root_dir(app.handle())?);
            *app.state::<AppState>().active_workspace.lock().unwrap() = registry.active;

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
            commands::auth::unlock,
            commands::auth::lock,
            commands::auth::unlock_biometric,
            commands::auth::enable_biometric,
            commands::auth::disable_biometric,
            commands::auth::change_master_password,
            commands::app::app_status,
            commands::app::app_ready,
            commands::app::set_settings,
            commands::vault::reveal_entry,
            commands::vault::save_entry,
            commands::vault::delete_entry,
            commands::vault::list_deleted,
            commands::vault::restore_entry,
            commands::vault::purge_entry,
            commands::vault::set_favorite,
            commands::vault::import_swftx,
            commands::vault::export_vault,
            commands::vault::save_env_file,
            commands::import::import_entries,
            commands::import::export_entries,
            commands::env::read_env_file,
            commands::generator::generate_password,
            commands::generator::generate_ssh_key,
            commands::generator::generate_otp,
            commands::audit::get_audit,
            commands::tools::scan_image,
            commands::tools::fetch_favicon,
            commands::clipboard::copy_to_clipboard,
            commands::setup::setup_drive_connect,
            commands::setup::setup_drive_disconnect,
            commands::setup::setup_restore_from_drive,
            commands::setup::setup_restore_from_file,
            commands::setup::setup_create,
            commands::sync::sync_connect,
            commands::sync::sync_disconnect,
            commands::sync::sync_now,
            commands::sync::sync_import,
            commands::share::share_create,
            commands::share::share_open,
            commands::share::share_revoke,
            commands::share::share_list,
            commands::workspace::workspace_select,
            commands::workspace::workspace_create,
            commands::workspace::workspace_rename,
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
