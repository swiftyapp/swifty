use crate::session;
use crate::state::AppState;
use crate::timer::Timer;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager, WindowEvent};

// The bounds are the settings module's: it normalises the stored value with
// the same numbers, so what the file holds is what gets armed here.
use crate::settings::{
    DEFAULT_AUTOLOCK_SECS as DEFAULT_TIMEOUT_SECS, MAX_AUTOLOCK_SECS as MAX_TIMEOUT_SECS,
};

/// The inactivity lock.
///
/// The timer is armed for the whole of an unlocked session and re-armed by
/// every sign of the user — input in the webview (`touch_activity`), the window
/// gaining or losing focus — so it comes due `timeout_secs` after the *last*
/// one, wherever the window is. An earlier version armed only on blur and
/// disarmed on focus, which left a focused window that nobody was at unlocked
/// indefinitely: a laptop walked away from with the app in front never locked.
pub struct AutoLock {
    /// The pending lock. One timer for the whole process: every activity
    /// re-arms it rather than adding to it, so a busy user cannot pile up
    /// pending locks.
    timer: Arc<Timer>,
    /// Idle seconds before an unlocked vault seals itself. Seeded from
    /// `settings.json` at startup and re-set whenever the Settings row changes,
    /// so the value the user picked is in force from the first arming.
    timeout_secs: AtomicU64,
}

impl Default for AutoLock {
    fn default() -> Self {
        Self {
            timer: Timer::spawn(),
            timeout_secs: AtomicU64::new(DEFAULT_TIMEOUT_SECS),
        }
    }
}

pub fn set_timeout(app: &AppHandle, secs: u64) {
    let autolock = app.state::<AutoLock>();
    autolock
        .timeout_secs
        .store(secs.clamp(1, MAX_TIMEOUT_SECS), Ordering::SeqCst);
    // Anything already pending was armed against the old value. Re-armed
    // rather than dropped: a session that is live stays on the clock, now the
    // new one.
    touch(app);
}

/// The user did something: start the idle clock over. A no-op with no session
/// to lock, so the frontend can call it freely.
///
/// `is_live`, not `is_unlocked`: a vault whose key is out with a password
/// change or a workspace create is still a vault to lock, and the operation
/// finds out when it tries to hand the key back (`Session::adopt`).
pub fn touch(app: &AppHandle) {
    if !app.state::<AppState>().session.lock().unwrap().is_live() {
        return;
    }
    let state = app.state::<AutoLock>();
    let timeout = Duration::from_secs(state.timeout_secs.load(Ordering::SeqCst));
    let app = app.clone();
    state.timer.arm(timeout, move || lock(&app));
}

/// Nothing left to lock. Called when a session ends, so a timer armed for the
/// session just sealed cannot come due inside the next one — an unlock a few
/// seconds later would otherwise be locked again by the old deadline.
pub fn disarm(app: &AppHandle) {
    app.state::<AutoLock>().timer.disarm();
}

/// Focus in either direction is activity: the user is switching to or from
/// the app. Backgrounding counts as a blur on every platform, so this one hook
/// covers the phone too: tao's iOS scene delegate posts `Focused(false)` from
/// `sceneWillResignActive:` and `Focused(true)` from `sceneDidBecomeActive:`
/// (tao 0.35.3, `platform_impl/ios/scene.rs:75-101`), and tauri-runtime-wry
/// forwards both unchanged off Windows (`lib.rs:522`). Sending the app to the
/// home screen therefore starts the same clock that alt-tabbing does.
///
/// One iOS-only caveat, which no code here can fix: the timer thread does not
/// run while iOS has the process suspended, so a lock that comes due in the
/// background lands when the app is next resumed rather than at the second it
/// was owed.
pub fn handle_event(app: &AppHandle, event: &WindowEvent) {
    if let WindowEvent::Focused(_) = event {
        touch(app);
    }
}

/// The lock an idle timer or the tray asks for, which may well find the vault
/// already sealed — a timer that comes due after a manual lock, the tray item
/// pressed twice. `session::lock` checks and seals under one guard and says
/// whether there was anything to seal, so a timer that comes due while a fresh
/// unlock is landing cannot clear the session that unlock just opened.
pub fn lock(app: &AppHandle) {
    session::lock(app);
}
