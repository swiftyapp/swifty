//! Sync commands.
//!
//! Nothing here does the work: every command validates, starts a run, and
//! returns. The run itself lives on a thread of its own and reports through the
//! `sync:*` events the frontend already listens for. That split is the whole
//! point of this rewrite — the first Drive implementation drove Google's API
//! from the command thread and froze the window for the length of a round trip.

use std::sync::atomic::Ordering;

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::list_metas;
use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::models::{EntryMetaDto, SyncStatus};
use crate::state::AppState;
use crate::sync;

/// Connect a sync provider (OAuth), then publish/adopt straight away so the
/// user sees the effect of connecting without a second click.
///
/// `async` because the consent flow blocks on a browser round trip and a
/// loopback listener; a synchronous command would run that on the main thread.
#[cfg(desktop)]
#[tauri::command]
pub async fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    authorize(&app, &state).await?;
    connected(&app);
    start_run(&app);
    Ok(())
}

/// Start the consent flow and return — see [`on_redirect`] for the other half.
///
/// Nothing here waits: Safari takes the screen and iOS suspends the app behind
/// it, so there is no result to wait for. The frontend is told by `sync:connected`
/// or `sync:error` rather than by this promise.
///
/// Synchronous on purpose, unlike its desktop twin. It does no blocking work,
/// and running on the IPC (main) thread is what puts the opener plugin's
/// `UIApplication.open` where UIKit requires it.
#[cfg(mobile)]
#[tauri::command]
pub fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    start_consent(&app, &state, false)
}

// Disconnect the sync provider (keeps the refresh token, per legacy).
#[tauri::command]
pub fn sync_disconnect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let cryptor = state.session.lock().unwrap().cryptor()?;
    sync::disconnect(&app, &cryptor)?;
    state.session.lock().unwrap().sync_configured = false;
    let _ = app.emit("sync:disconnected", ());
    Ok(())
}

/// Start a sync. Returns as soon as the run is scheduled; `sync:started` and
/// `sync:stopped` report the rest.
#[tauri::command]
pub fn sync_now(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    // Both of these are silent no-ops rather than errors. This is a routine
    // call, not a user action: the debounced auto-sync fires on a timer and can
    // easily land just after an auto-lock, or on a vault that was never
    // connected — neither is a sync failure to put in front of the user.
    let ready = {
        let session = state.session.lock().unwrap();
        session.is_unlocked() && session.sync_configured
    };
    if !ready {
        return Ok(());
    }
    start_run(&app);
    Ok(())
}

/// The "Import from Google Drive" flow: connect, then take on whatever the
/// account already holds.
///
/// It is a **merge**, not a restore. The legacy version overwrote the local
/// vault with the remote one, which silently discarded anything this device had
/// not pushed yet; adopting a remote vault wholesale is only ever correct on an
/// install that has none, and that is [`sync::restore`]'s job, not this one.
/// The caller is an unlocked (usually empty) vault, so a merge gives the same
/// result the user expects — every remote entry appears — without the risk.
#[cfg(desktop)]
#[tauri::command]
pub async fn sync_import(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    authorize(&app, &state).await?;
    connected(&app);
    let cryptor = state.session.lock().unwrap().cryptor()?;
    pull(&app, cryptor).await
}

/// The mobile twin of [`sync_import`]: start consent, adopt on the redirect.
#[cfg(mobile)]
#[tauri::command]
pub fn sync_import(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    start_consent(&app, &state, true)
}

/// Take on whatever the account holds, reporting through `vault:pull:*`.
async fn pull(app: &AppHandle, cryptor: Cryptor) -> Result<()> {
    let _ = app.emit("vault:pull:started", ());
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || sync::run(&handle, cryptor))
        .await
        .map_err(|e| Error::Other(e.to_string()))?;

    let payload = match &result {
        Ok(_) => json!({ "success": true, "data": { "entries": entry_metas(app) } }),
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    };
    let _ = app.emit("vault:pull:stopped", payload);
    result.map(|_| ())
}

// --- the mobile consent flow ---

/// Open the consent page and remember what the redirect will need.
///
/// The verifier is stored *after* the page is opened, which cannot race: iOS
/// delivers the redirect on a later turn of the same (main) run loop, so this
/// call has long returned by then.
#[cfg(mobile)]
fn start_consent(app: &AppHandle, state: &AppState, import: bool) -> Result<()> {
    let cryptor = state.session.lock().unwrap().cryptor()?;
    let verifier = sync::begin(app)?;
    *state.pending_auth.lock().unwrap() = Some(crate::state::PendingAuth {
        verifier,
        cryptor,
        import,
    });
    Ok(())
}

/// iOS reopened the app with a URL. If it is the OAuth redirect for a consent
/// flow we started, finish it; anything else is not ours.
///
/// Registered in `lib.rs`'s `setup`. Returns immediately — the token exchange
/// is a network round trip and must not run on the URL-open callback.
#[cfg(mobile)]
pub fn on_redirect(app: &AppHandle, url: &url::Url) {
    if !sync::is_oauth_redirect(url) {
        return;
    }
    let Some(pending) = app.state::<AppState>().pending_auth.lock().unwrap().take() else {
        return;
    };

    let app = app.clone();
    let url = url.clone();
    tauri::async_runtime::spawn(async move {
        match sync::complete(&app, &pending.cryptor, &url, &pending.verifier).await {
            Ok(()) => {
                connected(&app);
                if pending.import {
                    let _ = pull(&app, pending.cryptor).await;
                } else {
                    start_run(&app);
                }
            }
            Err(e) => {
                log::warn!("sync connect failed: {e}");
                let _ = app.emit("sync:error", json!({ "error": e.to_string() }));
            }
        }
    });
}

/// Mark the session connected and say so. The flag is session-only — what
/// actually makes a vault "configured" is the token file `write_tokens` just
/// wrote, which is what a later unlock reads.
fn connected(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut session = state.session.lock().unwrap();
    // A vault that locked behind the browser has no session to flag; the tokens
    // are on disk, so the next unlock picks the connection up anyway.
    if session.is_unlocked() {
        session.sync_configured = true;
    }
    drop(session);
    let _ = app.emit("sync:connected", ());
}

#[tauri::command]
pub fn sync_status(app: AppHandle, state: State<'_, AppState>) -> Result<SyncStatus> {
    // The session flag only exists after an unlock; while locked, answer from
    // the persisted (non-secret) settings so e.g. the lock screen can say
    // where the vault lives.
    let session = state.session.lock().unwrap();
    let configured = if session.is_unlocked() {
        session.sync_configured
    } else {
        crate::storage::sync_configured(&app)
    };
    Ok(SyncStatus { configured })
}

// Run the OAuth consent flow off the main thread.
#[cfg(desktop)]
async fn authorize(app: &AppHandle, state: &State<'_, AppState>) -> Result<()> {
    let cryptor = state.session.lock().unwrap().cryptor()?;
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || sync::setup(&handle, &cryptor))
        .await
        .map_err(|e| Error::Other(e.to_string()))?
}

/// Start a run unless one is already in flight, in which case this is a no-op:
/// a second request is dropped rather than queued, because a sync is
/// full-state and the run already underway will publish whatever the caller
/// wanted published.
///
/// The run gets a dedicated OS thread rather than `async_runtime::spawn`. The
/// Drive calls are driven with `block_on`, which is only legal off the async
/// runtime's own worker threads; a plain thread also guarantees that no amount
/// of network latency can reach the command or main thread.
fn start_run(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state
        .syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    // Cloned before the thread starts, so the run owns its credentials even if
    // the session auto-locks a moment later. Everything else it needs is taken
    // from the session per step, and a locked session simply ends the run.
    let cryptor = match session_cryptor(&state) {
        Some(cryptor) => cryptor,
        None => {
            state.syncing.store(false, Ordering::SeqCst);
            return;
        }
    };

    let app = app.clone();
    std::thread::spawn(move || {
        let _guard = RunGuard(app.clone());
        let _ = app.emit("sync:started", ());
        report(&app, sync::run(&app, cryptor));
    });
}

fn session_cryptor(state: &State<'_, AppState>) -> Option<Cryptor> {
    state.session.lock().unwrap().cryptor().ok()
}

// Announce the result, and — when the merge actually changed rows — hand the
// frontend the refreshed list. Emitting the metas rather than a bare "reload"
// signal keeps the store's update in one round trip and one render.
fn report(app: &AppHandle, result: Result<sync::engine::SyncOutcome>) {
    let payload = match &result {
        Ok(outcome) => {
            if outcome.merged > 0 {
                let _ = app.emit("vault:merged", json!({ "entries": entry_metas(app) }));
            }
            json!({ "success": true })
        }
        Err(e) => {
            log::warn!("sync failed: {e}");
            json!({ "success": false, "error": e.to_string() })
        }
    };
    let _ = app.emit("sync:stopped", payload);
}

// The current entry list, or an empty one if the vault locked in the meantime.
fn entry_metas(app: &AppHandle) -> Vec<EntryMetaDto> {
    let state = app.state::<AppState>();
    let session = state.session.lock().unwrap();
    session
        .store()
        .and_then(list_metas)
        .unwrap_or_else(|_| Vec::new())
}

// Clears the in-flight flag however the run ends, panics included — a wedged
// flag would disable sync for the rest of the process.
struct RunGuard(AppHandle);

impl Drop for RunGuard {
    fn drop(&mut self) {
        self.0
            .state::<AppState>()
            .syncing
            .store(false, Ordering::SeqCst);
    }
}
