use crate::state::AppState;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

const INACTIVE_TIMEOUT: Duration = Duration::from_secs(60);

// Monotonic token; every focus/blur bumps it, invalidating any pending timer.
#[derive(Default)]
pub struct AutoLock {
    generation: AtomicU64,
}

// Mirrors legacy setupWindowEvents: blur arms a re-lock timer, focus cancels it.
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
    let generation = app
        .state::<AutoLock>()
        .generation
        .fetch_add(1, Ordering::SeqCst)
        + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(INACTIVE_TIMEOUT);
        if app.state::<AutoLock>().generation.load(Ordering::SeqCst) == generation {
            lock(&app);
        }
    });
}

// Clear the session and tell the frontend to show the auth screen.
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
