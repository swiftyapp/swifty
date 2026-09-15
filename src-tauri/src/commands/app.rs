//! The one probe the frontend runs at launch.
//!
//! Everything here is cheap, non-secret and answerable while locked, which is
//! why it can be one round trip instead of the eight commands it replaces.

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::error::Result;
use crate::secure_store::{self, GateMode};
use crate::state::AppState;
use crate::{biometrics, locale, scan, storage};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    /// A SQLite vault DB exists. A legacy `vault.swftx` alone does NOT count:
    /// the app starts fresh and offers an explicit import instead.
    initialized: bool,
    version: String,
    locale: String,
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

    #[cfg(mobile)]
    let sync_pending = state.pending_auth.lock().unwrap().is_some();
    // Desktop's consent flow is started and forgotten, so the frontend learns
    // of it from `sync:pending` rather than by asking.
    #[cfg(desktop)]
    let sync_pending = false;

    Ok(AppStatus {
        initialized: storage::db_exists(&app),
        version: app.package_info().version.to_string(),
        locale: locale::system_locale(),
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
