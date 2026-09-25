//! The browser extension host's switches: on or off, the extensions let in,
//! and the answer to one asking.

use serde::Serialize;
use serde_json::json;
use tauri::AppHandle;

use crate::browser::{self, manifest};
use crate::error::Result;
use crate::settings::{self, BrowserClient};
use crate::storage;

/// The host as Settings shows it.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStatus {
    pub enabled: bool,
    pub browsers: Vec<manifest::Status>,
    pub clients: Vec<BrowserClient>,
}

fn status(app: &AppHandle) -> Result<BrowserStatus> {
    let root = storage::root_dir(app)?;
    let browser = settings::current(app).browser;
    Ok(BrowserStatus {
        enabled: browser.enabled,
        browsers: manifest::status(&root),
        clients: browser.clients,
    })
}

#[tauri::command]
pub fn browser_status(app: AppHandle) -> Result<BrowserStatus> {
    status(&app)
}

/// Turn the host on — writing the manifests every browser here finds it by,
/// and listening — or off, taking the manifests back. The listener stays up
/// once started (see `browser::server`); off means it refuses what arrives.
#[tauri::command]
pub fn browser_set_enabled(enabled: bool, app: AppHandle) -> Result<BrowserStatus> {
    let root = storage::root_dir(&app)?;
    let mut browser = settings::current(&app).browser;
    browser.enabled = enabled;
    settings::set(&app, &json!({ "browser": browser }))?;
    if enabled {
        manifest::install(&root);
        browser::server::start(&app);
    } else {
        manifest::remove(&root);
    }
    status(&app)
}

/// The user's answer to an extension asking to connect: the name they gave
/// it, or `null` to refuse. Nothing happens when no ask is up.
#[tauri::command]
pub fn browser_respond(name: Option<String>) -> Result<()> {
    browser::respond(name);
    Ok(())
}

/// Take an extension's access back. Its next request fails the association
/// check, and it has to ask — and be let in — again.
#[tauri::command]
pub fn browser_forget_client(key: String, app: AppHandle) -> Result<BrowserStatus> {
    let mut browser = settings::current(&app).browser;
    browser.clients.retain(|c| c.key != key);
    settings::set(&app, &json!({ "browser": browser }))?;
    status(&app)
}
