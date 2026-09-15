//! The one probe the frontend runs at launch.
//!
//! Everything here is cheap, non-secret and answerable while locked, which is
//! why it can be one round trip instead of the eight commands it replaces.

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::error::Result;
use crate::secure_store::{self, GateMode};
use crate::settings::Settings;
use crate::state::AppState;
use crate::{autolock, biometrics, locale, scan, settings, storage};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    /// A SQLite vault DB exists. A legacy `vault.swftx` alone does NOT count:
    /// the app starts fresh and offers an explicit import instead.
    initialized: bool,
    version: String,
    /// The locale to open in: the stored choice narrowed to a shipped
    /// catalogue, or the OS's (see `locale::resolve_preferred`).
    locale: String,
    /// Every preference, hydrated into the frontend's prefs store at boot.
    settings: Settings,
    sync_configured: bool,
    /// A consent flow is out with the browser. Owned here, not by the frontend:
    /// the backend is what starts and ends it, so it is the one that can say.
    sync_pending: bool,
    scan_supported: bool,
    biometric: Biometric,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Biometric {
    /// The platform gates a secure store, the hardware is there, and the user
    /// has opted in.
    available: bool,
    /// Whether enrolling *could* work here — what onboarding asks before
    /// offering it, where `available` would always say no.
    can_enroll: bool,
    /// "face", "touch" or "none", so the UI can name the gate rather than
    /// guess it from the platform (a Touch ID iPad is not Face ID).
    #[serde(rename = "type")]
    kind: &'static str,
    /// Which gate the enrolled key actually sits behind, or `null` when there
    /// is no enrollment.
    mode: Option<String>,
}

#[tauri::command]
pub fn app_status(app: AppHandle, state: State<'_, AppState>) -> Result<AppStatus> {
    let hardware = secure_store::is_supported() && biometrics::is_available();
    let marker = storage::biometric_marker(&app);

    // The session flag only exists after an unlock; while locked, answer from
    // the persisted (non-secret) settings so e.g. the lock screen can say
    // where the vault lives.
    let session = state.session.lock().unwrap();
    let sync_configured = if session.is_unlocked() {
        session.sync_configured
    } else {
        storage::sync_configured(&app)
    };
    drop(session);

    // The same answer `sync:status` carries, so a fresh webview and one that
    // has been listening agree.
    let sync_pending = state.sync_run.lock().unwrap().pending;

    let settings = settings::current(&app);

    Ok(AppStatus {
        initialized: storage::db_exists(&app),
        version: app.package_info().version.to_string(),
        locale: locale::resolve_preferred(settings.locale.as_deref()),
        settings,
        sync_configured,
        sync_pending,
        scan_supported: scan::is_supported(),
        biometric: Biometric {
            available: hardware && storage::biometric_enrolled(&app),
            can_enroll: hardware,
            kind: biometrics::kind(),
            mode: marker.map(|m| GateMode::from_marker(&m).as_marker().to_string()),
        },
    })
}

/// Apply a partial settings object and hand the whole merged result back, so a
/// caller that patched one key ends up holding exactly what is on disk.
///
/// The auto-lock is re-armed from here rather than by the frontend: this is the
/// only place the value can change, so it is the only place that has to know.
#[tauri::command]
pub fn set_settings(app: AppHandle, patch: serde_json::Value) -> Result<Settings> {
    let before = settings::current(&app).autolock_secs;
    let settings = settings::set(&app, &patch)?;
    if settings.autolock_secs != before {
        autolock::set_timeout(&app, settings.autolock_secs);
    }
    Ok(settings)
}
