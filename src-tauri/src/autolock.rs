use crate::error::Result;
use crate::state::AppState;
use crate::timer::Timer;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

const DEFAULT_TIMEOUT_SECS: u64 = 60;
// A day. The row offers far less, but the command is reachable from the
// frontend, and a timeout measured in years is indistinguishable from "never" —
// which is not a setting a password manager should be talked into.
const MAX_TIMEOUT_SECS: u64 = 24 * 60 * 60;

pub struct AutoLock {
    /// The pending lock. One timer for the whole process: a blur re-arms it and
    /// a focus disarms it, so alt-tabbing cannot pile up pending locks.
    timer: Arc<Timer>,
    /// Idle seconds before an unfocused, unlocked vault seals itself. Set from
    /// the frontend on unlock and whenever the Settings row changes, so the
    /// value the user picked survives a focus cycle without a restart.
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

#[tauri::command]
pub fn set_autolock_timeout(app: AppHandle, secs: u64) -> Result<()> {
    let autolock = app.state::<AutoLock>();
    autolock
        .timeout_secs
        .store(secs.clamp(1, MAX_TIMEOUT_SECS), Ordering::SeqCst);
    // Anything already pending was armed against the old value; the next blur
    // arms against the new one.
    autolock.timer.disarm();
    Ok(())
}

/// Backgrounding counts as a blur on every platform, so this one hook covers
/// the phone too: tao's iOS scene delegate posts `Focused(false)` from
/// `sceneWillResignActive:` and `Focused(true)` from `sceneDidBecomeActive:`
/// (tao 0.35.3, `platform_impl/ios/scene.rs:75-101`), and tauri-runtime-wry
/// forwards both unchanged off Windows (`lib.rs:522`). Sending the app to the
/// home screen therefore arms the same timer that alt-tabbing does.
///
/// One iOS-only caveat, which no code here can fix: the timer thread does not
/// run while iOS has the process suspended, so a lock that comes due in the
/// background lands when the app is next resumed rather than at the second it
/// was owed.
pub fn handle_event(app: &AppHandle, event: &WindowEvent) {
    if let WindowEvent::Focused(focused) = event {
        if *focused {
            app.state::<AutoLock>().timer.disarm();
        } else {
            arm(app);
        }
    }
}

fn arm(app: &AppHandle) {
    if !app
        .state::<AppState>()
        .session
        .lock()
        .unwrap()
        .is_unlocked()
    {
        return;
    }
    let state = app.state::<AutoLock>();
    let timeout = Duration::from_secs(state.timeout_secs.load(Ordering::SeqCst));
    let app = app.clone();
    state.timer.arm(timeout, move || lock(&app));
}

pub fn lock(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut session = state.session.lock().unwrap();
    if !session.is_unlocked() {
        return;
    }
    session.clear();
    drop(session);
    let _ = app.emit("vault:locked", ());
}
