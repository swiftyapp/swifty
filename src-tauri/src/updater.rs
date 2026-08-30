use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Checks for and silently installs an update in the background.
/// Failures are only logged — never surfaced as a user-facing dialog.
pub fn check(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run(app).await {
            log::warn!("updater check failed: {e}");
        }
    });
}

async fn run(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        update.download_and_install(|_, _| {}, || {}).await?;
    }
    Ok(())
}
