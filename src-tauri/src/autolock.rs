use crate::error::Result;
use crate::state::AppState;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

const DEFAULT_TIMEOUT_SECS: u64 = 60;

pub struct AutoLock {
    generation: AtomicU64,
    /// Idle seconds before an unfocused, unlocked vault seals itself. Set from
    /// the frontend on unlock and whenever the Settings row changes, so the
    /// value the user picked survives a focus cycle without a restart.
    timeout_secs: AtomicU64,
}

impl Default for AutoLock {
    fn default() -> Self {
        Self {
            generation: AtomicU64::new(0),
            timeout_secs: AtomicU64::new(DEFAULT_TIMEOUT_SECS),
        }
    }
}

#[tauri::command]
pub fn set_autolock_timeout(app: AppHandle, secs: u64) -> Result<()> {
    app.state::<AutoLock>()
        .timeout_secs
        .store(secs.max(1), Ordering::SeqCst);
    Ok(())
}

pub fn handle_event(app: &AppHandle, event: &WindowEvent) {
    if let WindowEvent::Focused(focused) = event {
        let autolock = app.state::<AutoLock>();
        if *focused {
            autolock.generation.fetch_add(1, Ordering::SeqCst);
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
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let timeout = Duration::from_secs(state.timeout_secs.load(Ordering::SeqCst));
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(timeout);
        if app.state::<AutoLock>().generation.load(Ordering::SeqCst) == generation {
            lock(&app);
        }
    });
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
