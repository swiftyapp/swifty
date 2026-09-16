//! Sync commands.
//!
//! Nothing here does the work: every command validates, starts a run, and
//! returns. The run itself lives on a thread of its own and reports through the
//! `sync:*` events the frontend already listens for. That split is the whole
//! point of this rewrite — the first Drive implementation drove Google's API
//! from the command thread and froze the window for the length of a round trip.

use std::sync::atomic::Ordering;
#[cfg(mobile)]
use std::time::Duration;

use tauri::{AppHandle, Manager, State};

use crate::crypto::Cryptor;
use crate::error::Result;
use crate::events;
use crate::models::EntryMetaDto;
use crate::session::list_metas;
use crate::state::AppState;
#[cfg(mobile)]
use crate::state::AuthPurpose;
use crate::sync;

/// Connect a sync provider (OAuth), then publish/adopt straight away so the
/// user sees the effect of connecting without a second click.
///
/// Returns as soon as the session has a cryptor to give: the consent flow is a
/// browser round trip, and the frontend hears how it went on `sync:connected` /
/// `sync:error` rather than from this promise — the same story mobile tells.
#[cfg(desktop)]
#[tauri::command]
pub fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    crate::workspace::guard_primary(&app)?;
    let cryptor = state.session.lock().unwrap().cryptor()?;
    spawn_consent(&app, cryptor, Follow::Run);
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
    crate::workspace::guard_primary(&app)?;
    start_consent(&app, &state, AuthPurpose::Connect)
}

// Disconnect the sync provider (keeps the refresh token, per legacy).
#[tauri::command]
pub fn sync_disconnect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let cryptor = state.session.lock().unwrap().cryptor()?;
    sync::disconnect(&app, &cryptor)?;
    state.session.lock().unwrap().sync_configured = false;
    events::sync_disconnected(&app);
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
pub fn sync_import(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    crate::workspace::guard_primary(&app)?;
    let cryptor = state.session.lock().unwrap().cryptor()?;
    spawn_consent(&app, cryptor, Follow::Pull);
    Ok(())
}

/// The mobile twin of [`sync_import`]: start consent, adopt on the redirect.
#[cfg(mobile)]
#[tauri::command]
pub fn sync_import(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    crate::workspace::guard_primary(&app)?;
    start_consent(&app, &state, AuthPurpose::Import)
}

/// What a connection is for: publishing what this device has, or taking on what
/// the account already holds.
#[cfg(desktop)]
#[derive(Clone, Copy)]
enum Follow {
    Run,
    Pull,
}

/// Run the desktop consent flow on a thread of its own. `sync::setup` waits on
/// a loopback listener and drives Drive with `block_on`, so it may never run on
/// the command thread nor on an async worker.
#[cfg(desktop)]
fn spawn_consent(app: &AppHandle, cryptor: Cryptor, follow: Follow) {
    events::sync_pending(app);
    let app = app.clone();
    std::thread::spawn(move || match sync::setup(&app, &cryptor) {
        Ok(()) => {
            connected(&app);
            match follow {
                Follow::Run => start_run(&app),
                Follow::Pull => pull(&app, cryptor),
            }
        }
        Err(e) => {
            log::warn!("sync connect failed: {e}");
            events::sync_error(&app, &e.to_string());
        }
    });
}

/// Take on whatever the account holds. The refreshed list always goes out on a
/// success: the user connected in order to see what was up there, and "nothing
/// new" is an answer worth rendering.
///
/// Blocking, and deliberately: `sync::run` drives Drive with `block_on`, so
/// every caller has to be a plain thread (see [`start_run`]).
fn pull(app: &AppHandle, cryptor: Cryptor) {
    events::sync_started(app);
    match sync::run(app, cryptor) {
        Ok(_) => {
            events::vault_merged(app, entry_metas(app));
            events::sync_stopped(app, None);
        }
        Err(e) => {
            log::warn!("sync import failed: {e}");
            events::sync_stopped(app, Some(e.to_string()));
        }
    }
}

// --- the mobile consent flow ---
//
// A consent flow is a value with a lifecycle, not a flag. It is created by
// `start_consent`, identified by its `state` nonce, and ends in exactly one of
// four ways — the redirect it was waiting for (`on_redirect`), Google's refusal
// (also `on_redirect`), the user coming back without one (`on_resume`), or old
// age (`CONSENT_TTL`). Each end is announced to the frontend, so `sync:pending`
// is always followed by `sync:connected` or `sync:error`.

/// How long a consent request stays redeemable. Google's own codes die well
/// inside this; it exists so a flow the OS never told us about (the app was
/// killed in the background, say) cannot be finished by a redirect from a
/// previous life.
#[cfg(mobile)]
const CONSENT_TTL: Duration = Duration::from_secs(10 * 60);

/// How long after the app comes back to the foreground a redirect may still
/// arrive for a pending flow before it is written off as abandoned. iOS delivers
/// the URL around the same activation, not seconds later, so this is generous.
#[cfg(mobile)]
const RESUME_GRACE: Duration = Duration::from_secs(3);

/// Open the consent page and remember what the redirect will need.
///
/// The record is stored *after* the page is opened, which cannot race: iOS
/// delivers the redirect on a later turn of the same (main) run loop, so this
/// call has long returned by then. A flow already pending is simply replaced —
/// its nonce dies with it, so its redirect, if one ever comes, is foreign.
///
/// Crate-visible: onboarding's `setup_drive_connect` is the same flow with a
/// different purpose, and must not fork the bookkeeping.
#[cfg(mobile)]
pub(crate) fn start_consent(app: &AppHandle, state: &AppState, purpose: AuthPurpose) -> Result<()> {
    // Setup runs before any vault exists, so there is no session to take a
    // cryptor from — and nothing to seal the tokens with until the restore or
    // create that follows makes a key.
    let cryptor = match purpose {
        AuthPurpose::Setup => None,
        _ => Some(state.session.lock().unwrap().cryptor()?),
    };
    let started = sync::begin(app)?;
    *state.pending_auth.lock().unwrap() = Some(crate::state::PendingAuth {
        verifier: started.verifier,
        state: started.state,
        cryptor,
        purpose,
        started: std::time::Instant::now(),
    });
    // Onboarding announces itself on its own `setup:drive:*` family, because it
    // runs on a screen that knows nothing about sync settings.
    match purpose {
        AuthPurpose::Setup => events::setup_drive_pending(app),
        _ => events::sync_pending(app),
    }
    Ok(())
}

/// iOS reopened the app with a URL. If it is Google's answer to the consent
/// flow we have pending, finish it; anything else is not ours and leaves the
/// pending flow exactly as it was.
///
/// Registered in `lib.rs`'s `setup`. Returns immediately — the token exchange
/// is a network round trip and must not run on the URL-open callback.
#[cfg(mobile)]
pub fn on_redirect(app: &AppHandle, url: &url::Url) {
    if !sync::redirect_matches(app, url) {
        return;
    }
    let state = app.state::<AppState>();
    let mut slot = state.pending_auth.lock().unwrap();
    let Some(pending) = slot.as_ref() else {
        return;
    };
    // Judge the URL against the pending request *before* consuming it, so a URL
    // that is not the answer costs the real answer nothing.
    let purpose = pending.purpose;
    let code = match sync::parse_redirect(url, &pending.state) {
        sync::Redirect::Foreign => {
            log::warn!("ignoring a redirect that does not answer the pending sign-in");
            return;
        }
        sync::Redirect::Denied(why) => {
            slot.take();
            drop(slot);
            fail(app, purpose, why);
            return;
        }
        sync::Redirect::Code(code) => code,
    };
    let pending = slot.take().expect("checked above");
    drop(slot);
    if pending.started.elapsed() > CONSENT_TTL {
        fail(
            app,
            purpose,
            "Google sign-in took too long; try again".into(),
        );
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // Onboarding has nowhere to write tokens yet and a different story to
        // tell the frontend, so it finishes the exchange for itself.
        if purpose == AuthPurpose::Setup {
            crate::commands::setup::on_consent(&app, &code, &pending.verifier).await;
            return;
        }
        // Unreachable: every other purpose is started from an unlocked session.
        let Some(cryptor) = pending.cryptor else {
            fail(&app, purpose, "the vault was locked during sign-in".into());
            return;
        };
        match sync::complete(&app, &cryptor, &code, &pending.verifier).await {
            Ok(()) => {
                connected(&app);
                if purpose == AuthPurpose::Import {
                    // A plain thread, for the same reason `start_run` uses one.
                    let handle = app.clone();
                    std::thread::spawn(move || pull(&handle, cryptor));
                } else {
                    start_run(&app);
                }
            }
            Err(e) => fail(&app, purpose, e.to_string()),
        }
    });
}

/// The window is back in front. If a consent flow is still pending once the
/// redirect has had its chance to arrive, the user came back without finishing
/// it — close the flow out, so the frontend is not left waiting on an answer
/// that is never coming.
///
/// Called from the window event hook (`window.rs`) on iOS scene activation.
#[cfg(mobile)]
pub fn on_resume(app: &AppHandle) {
    // Only ever abandon the flow that was pending *at resume*: if the user
    // starts a fresh one inside the grace period, its nonce differs and it is
    // left alone.
    let Some(nonce) = app
        .state::<AppState>()
        .pending_auth
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.state.clone())
    else {
        return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(RESUME_GRACE);
        let abandoned = {
            let state = app.state::<AppState>();
            let mut slot = state.pending_auth.lock().unwrap();
            match slot.as_ref() {
                Some(p) if p.state == nonce => slot.take(),
                _ => None,
            }
        };
        if let Some(abandoned) = abandoned {
            fail(
                &app,
                abandoned.purpose,
                "Google sign-in was cancelled".into(),
            );
        }
    });
}

/// The consent flow ended without a connection. One place, so every ending
/// reports the same way — on whichever event family the flow was started under.
#[cfg(mobile)]
fn fail(app: &AppHandle, purpose: AuthPurpose, why: String) {
    log::warn!("sync connect failed: {why}");
    if purpose == AuthPurpose::Setup {
        events::setup_drive_error(app, &why);
        return;
    }
    events::sync_error(app, &why);
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
    events::sync_connected(app);
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
        events::sync_started(&app);
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
    match result {
        Ok(outcome) => {
            if outcome.merged > 0 {
                events::vault_merged(app, entry_metas(app));
            }
            events::sync_stopped(app, None);
        }
        Err(e) => {
            log::warn!("sync failed: {e}");
            events::sync_stopped(app, Some(e.to_string()));
        }
    }
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
