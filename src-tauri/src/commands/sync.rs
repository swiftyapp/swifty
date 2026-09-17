//! Sync commands.
//!
//! Nothing here does the work: every command validates, starts a run, and
//! returns. The run itself lives on a thread of its own and reports through
//! `sync:status`. That split is the whole point of this rewrite — the first
//! Drive implementation drove Google's API from the command thread and froze
//! the window for the length of a round trip.
//!
//! The frontend never reconstructs sync state from a sequence of events: every
//! transition updates [`SyncRun`] and re-emits the whole [`SyncStatus`], which
//! the frontend stores as-is. One event, one shape, no order to agree on.
//!
//! Every run starts in [`start_run`], whichever command asked for it — a scheduled
//! sync, `sync_now`, or the run behind a connect. One launcher means one claim,
//! and one claim is what keeps two runs from addressing the account at the same
//! time.
//!
//! Connecting is not always a run. A vault that has never synced is asked what
//! the account holds first: if the account already has vaults, the user is
//! shown them and restores one — every device connected to an account syncs
//! the vaults it holds rather than adding a pack beside them. Only an empty
//! account takes this vault as its first ([`sync_adopt_pending`]).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
#[cfg(mobile)]
use std::time::Duration;

use tauri::{AppHandle, Manager, State};

use crate::crypto::Cryptor;
use crate::error::Result;
use crate::events;
use crate::models::EntryMetaDto;
use crate::session::list_metas;
#[cfg(mobile)]
use crate::state::AuthPurpose;
use crate::state::{AppState, SyncRun, SyncStatus};
use crate::sync;

/// Connect a sync provider (OAuth), then publish/adopt straight away so the
/// user sees the effect of connecting without a second click.
///
/// Returns as soon as the session has a cryptor to give: the consent flow is a
/// browser round trip, and the frontend hears how it went on `sync:status`
/// rather than from this promise — the same story mobile tells.
///
/// Any workspace may connect: the token file resolves under the active
/// workspace's directory, and the vault's own id names the pack it syncs
/// (`Rowel/Vaults/<vault-id>.rowel`), so two workspaces share neither
/// credentials nor a file even when the user points them at the same Drive.
/// What they do share is the OAuth grant behind those credentials, which Google
/// keeps per account and client rather than per token — see [`sync_disconnect`].
///
/// A vault that has never synced takes the other road: onboarding's keyless
/// connect, which probes the account and reports what it holds on the
/// `setup:drive:*` events (see the module docs). The frontend then restores one
/// of the account's vaults, or — for an empty account — calls
/// [`sync_adopt_pending`] to make this vault its first.
#[cfg(desktop)]
#[tauri::command]
pub fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if never_synced(&app, &state)? {
        return super::setup::connect_pending(&app);
    }
    spawn_consent(&app, &state)
}

/// Start the consent flow and return — see [`on_redirect`] for the other half.
///
/// Nothing here waits: Safari takes the screen and iOS suspends the app behind
/// it, so there is no result to wait for. The frontend is told by `sync:status`
/// rather than by this promise.
///
/// Synchronous on purpose, unlike its desktop twin. It does no blocking work,
/// and running on the IPC (main) thread is what puts the opener plugin's
/// `UIApplication.open` where UIKit requires it.
#[cfg(mobile)]
#[tauri::command]
pub fn sync_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    // The same fork as desktop; the keyless connect reports on its own events.
    if never_synced(&app, &state)? {
        return super::setup::connect_pending(&app, &state);
    }
    start_consent(&app, &state, AuthPurpose::Connect).inspect_err(|e| failed(&app, e.to_string()))
}

/// Whether the open vault has yet to sync anywhere: it has no vault id, so no
/// pack on any account is its own. Under the session lock alone — the vault id
/// is a read off `meta`, and the caller takes the workspace lock for the step
/// that follows.
///
/// A vault that locked under the press is reported as status, as every other
/// connect that fails before the browser opens is, so the frontend never has
/// to turn a rejected promise into state itself.
fn never_synced(app: &AppHandle, state: &State<'_, AppState>) -> Result<bool> {
    let session = state.session.lock().unwrap();
    let store = session.store().inspect_err(|e| failed(app, e.to_string()))?;
    Ok(crate::store::identity::vault_id(store)
        .map_err(crate::session::store_err)?
        .is_none())
}

/// The account the probe found empty becomes this vault's: the tokens it left
/// pending are sealed under the open vault's key, and the run that follows
/// mints the vault's id and creates its pack.
///
/// Only ever called after a `setup:drive:probed` that listed no vault. With one
/// listed, the frontend restores it instead; the tokens are then the restore's
/// to take. Nothing pending is an error rather than a silent success: the
/// frontend would otherwise show "Connected" over a vault with no token file.
#[tauri::command]
pub fn sync_adopt_pending(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    // Key, tokens and flag under the workspace lock, as one step: a switch
    // cannot land between taking this workspace's key and sealing the account
    // under it (see `commands::workspace::guard_sync_idle`).
    {
        let _paths = state.workspace_lock.lock().unwrap();
        let cryptor = state.session.lock().unwrap().cryptor()?;
        let tokens = super::setup::peek_pending(&state)?;
        sync::persist_tokens(&app, &cryptor, &tokens)?;
        // Taken only once written: a failure above leaves them for a retry.
        super::setup::take_pending(&state);
    }
    // The run is claimed before the connect is announced, as `spawn_consent`
    // orders it, so the first upload cannot be skipped by a switch landing in
    // between.
    start_run(&app);
    connected(&app);
    Ok(())
}

/// Disconnect the sync provider for the workspace that is open: its token file
/// is deleted, and nothing on this device can reconnect without fresh consent.
///
/// Local only, on purpose. Google's revocation endpoint retires the whole grant
/// for an account and OAuth client — every token this app ever got for that
/// account, in every workspace and on every device — so it is not a thing one
/// workspace can do on its own behalf, and this install cannot tell which
/// other workspaces (or other devices) share the account: their token files
/// are sealed under keys it does not hold. Signing this app out of Google is a
/// separate, explicitly global action, and one the UI does not offer yet.
#[tauri::command]
pub fn sync_disconnect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    // Only an unlocked vault can be disconnected: the token file is its own,
    // and the paths below resolve to the workspace that is open.
    state.session.lock().unwrap().cryptor()?;
    // `?`, and before anything below it: if the delete failed the token file —
    // and the usable refresh token in it — is still on disk, so the vault is
    // still connected. Flipping the session flag or clearing the run state here
    // would show the user a disconnected account over a live credential. A
    // token refresh awaiting Google meanwhile finds the connection generation
    // changed and skips its write-back (see `AppState::sync_generation`).
    sync::disconnect(&app)?;
    state.session.lock().unwrap().sync_configured = false;
    // The timestamp goes with the connection: the next one is a new pairing,
    // and "synced 3m ago" from a previous one would be a lie about it.
    update(&app, |run| {
        run.pending = false;
        run.error = None;
        run.last_synced_at = None;
    });
    Ok(())
}

/// Start a sync. Returns as soon as the run is scheduled; `sync:status`
/// reports the rest.
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

/// A connect that fails before the browser even opens (the vault locked under
/// it) is still reported as status, so the frontend never has to turn a
/// rejected promise into state itself.
#[cfg(desktop)]
fn cryptor_or_report(app: &AppHandle, state: &State<'_, AppState>) -> Result<Cryptor> {
    state
        .session
        .lock()
        .unwrap()
        .cryptor()
        .inspect_err(|e| failed(app, e.to_string()))
}

/// Run the desktop consent flow on the blocking pool. `sync::setup` waits on a
/// loopback listener and drives Drive with `block_on`, so it may never run on
/// the command thread nor on an async worker — see [`super::detached`].
#[cfg(desktop)]
fn spawn_consent(app: &AppHandle, state: &State<'_, AppState>) -> Result<()> {
    // Key and flag under the workspace lock, as one step: a switch cannot land
    // between taking this workspace's key and announcing the flow that will
    // write with it (see `commands::workspace::guard_sync_idle`).
    // The connection generation is read here too, synchronously, and carried
    // to the worker: read on the worker instead, a disconnect landing before
    // the worker starts would go unnoticed and the consent it was meant to
    // cancel would be accepted (see `AppState::sync_generation`).
    let (cryptor, generation) = {
        let _paths = state.workspace_lock.lock().unwrap();
        let cryptor = cryptor_or_report(app, state)?;
        pending(app);
        (cryptor, sync::connection_generation(app))
    };
    let app = app.clone();
    super::detached(move || match sync::setup(&app, &cryptor, generation) {
        // The run is claimed before the consent is marked over, so the flags
        // overlap rather than leave a gap a workspace switch could use — and
        // the first upload cannot be skipped by one landing there.
        Ok(()) => {
            start_run(&app);
            connected(&app);
        }
        Err(e) => failed(&app, e.to_string()),
    });
    Ok(())
}

// --- the mobile consent flow ---
//
// A consent flow is a value with a lifecycle, not a flag. It is created by
// `start_consent`, identified by its `state` nonce, and ends in exactly one of
// four ways — the redirect it was waiting for (`on_redirect`), Google's refusal
// (also `on_redirect`), the user coming back without one (`on_resume`), or old
// age (`CONSENT_TTL`). Each end is announced to the frontend, so a `pending`
// status is always followed by one that is not.

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
    // Key and pending flow recorded under the workspace lock, as one step, for
    // the reason `spawn_consent` gives on desktop.
    let _paths = state.workspace_lock.lock().unwrap();
    // Setup runs before any vault exists, so there is no session to take a
    // cryptor from — and nothing to seal the tokens with until the restore or
    // create that follows makes a key.
    let cryptor = match purpose {
        AuthPurpose::Setup => None,
        _ => Some(state.session.lock().unwrap().cryptor()?),
    };
    // One consent at a time, and checked before Safari is opened for a second.
    // Replacing the pending flow would orphan it: its redirect could never be
    // matched again, and if it was reporting on the other event family (a sync
    // connect displaced by a workspace restore, or the reverse) its screen
    // would say "waiting" for good. A flow the user walked away from does not
    // block for long — `on_resume` writes it off once the redirect has had its
    // chance to arrive.
    if state.pending_auth.lock().unwrap().is_some() {
        return Err(crate::error::Error::Other(
            "another Google sign-in is still waiting for its answer; finish or cancel it first"
                .into(),
        ));
    }
    let started = sync::begin(app)?;
    *state.pending_auth.lock().unwrap() = Some(crate::state::PendingAuth {
        verifier: started.verifier,
        state: started.state,
        cryptor,
        purpose,
        started: std::time::Instant::now(),
        generation: sync::connection_generation(app),
    });
    // Onboarding announces itself on its own `setup:drive:*` family, because it
    // runs on a screen that knows nothing about sync settings.
    match purpose {
        AuthPurpose::Setup => events::setup_drive_pending(app),
        _ => pending(app),
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
        match sync::complete(&app, &cryptor, &code, &pending.verifier, pending.generation).await {
            Ok(()) => {
                // The run is claimed before the consent is marked over, as in
                // `spawn_consent`; the run itself goes to the blocking pool for
                // the reason `launch` gives.
                start_run(&app);
                connected(&app);
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
    // The process's one re-armable timer for this, not a thread that sleeps:
    // every activation would otherwise park an OS thread for the grace period,
    // and a user flicking between apps produces a run of them. Re-arming is
    // also the behaviour we want — the latest resume is the one whose grace
    // period counts.
    let handle = app.clone();
    app.state::<AppState>()
        .consent_grace
        .arm(RESUME_GRACE, move || {
            let abandoned = {
                let state = handle.state::<AppState>();
                let mut slot = state.pending_auth.lock().unwrap();
                match slot.as_ref() {
                    Some(p) if p.state == nonce => slot.take(),
                    _ => None,
                }
            };
            if let Some(abandoned) = abandoned {
                fail(
                    &handle,
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
    if purpose == AuthPurpose::Setup {
        log::warn!("drive setup failed: {why}");
        events::setup_drive_error(app, &why);
        return;
    }
    failed(app, why);
}

// --- status ------------------------------------------------------------------

/// Change the run state and tell the frontend the whole of it. Through
/// `SyncRun::transition`, so the snapshot's sequence advances with the change
/// and a probe that read the state just before it is recognisably older.
fn update(app: &AppHandle, change: impl FnOnce(&mut SyncRun)) {
    app.state::<AppState>()
        .sync_run(|run| run.transition(change));
    events::sync_status(app, status(app));
}

/// The browser is out with a consent request.
fn pending(app: &AppHandle) {
    update(app, |run| {
        run.pending = true;
        run.error = None;
    });
}

/// The consent flow ended without a connection.
fn failed(app: &AppHandle, why: String) {
    log::warn!("sync connect failed: {why}");
    update(app, |run| {
        run.pending = false;
        run.error = Some(why);
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
    update(app, |run| {
        run.pending = false;
        run.error = None;
    });
}

/// A run is in flight. A retry after a failure reads as "syncing" rather than
/// staying red until it lands.
fn started(app: &AppHandle) {
    update(app, |run| {
        run.in_progress = true;
        run.error = None;
    });
}

/// A run ended — see [`SyncRun::finish`] for what that leaves standing.
fn finished(app: &AppHandle, error: Option<String>) {
    if let Some(why) = &error {
        log::warn!("sync failed: {why}");
    }
    update(app, |run| run.finish(error));
}

/// The whole of sync as the frontend should see it right now.
pub(crate) fn status(app: &AppHandle) -> SyncStatus {
    let state = app.state::<AppState>();
    // The session flag only exists after an unlock; while locked, answer from
    // the persisted (non-secret) settings so e.g. the lock screen can say
    // where the vault lives.
    let session = state.session.lock().unwrap();
    let configured = if session.is_unlocked() {
        session.sync_configured
    } else {
        crate::storage::sync_configured(app)
    };
    drop(session);
    state.sync_run(|run| run.status(configured))
}

/// The active workspace changed: say what sync looks like for the new one.
///
/// A transition rather than a bare emit, and that is the point: the snapshot the
/// frontend is holding describes the workspace that just locked, which may have
/// been through more transitions than the one being switched to has. Going
/// through `update` gives this one the later sequence, so it is taken rather
/// than discarded as stale (see `SYNC_SEQ`). The re-probe that `vault:locked`
/// triggers then answers with the same snapshot.
pub(crate) fn switched(app: &AppHandle) {
    update(app, |_| {});
}

// --- runs ----------------------------------------------------------------------

/// Start one run against this vault's own pack, from the live session, unless
/// one is already in flight — in which case nothing is started.
///
/// **Every** run in the process starts here, whatever asked for it — the
/// debounced auto-sync, `sync_now`, the run behind a fresh connect — because
/// the claim below is the only thing keeping two of them apart, and they must
/// be kept apart: two runs racing resolve the vault id independently, so they
/// can settle on different ids and publish a pack each, leaving one vault
/// spread across two files in the account.
///
/// A run turned away here is a no-op rather than an error: a sync is
/// full-state, so the run already underway publishes whatever this caller
/// wanted published.
///
/// The run goes to the blocking pool rather than `async_runtime::spawn`. The
/// Drive calls are driven with `block_on`, which is only legal off the async
/// runtime's own worker threads — a blocking-pool thread is not one of them —
/// and it also guarantees that no amount of network latency can reach the
/// command or main thread.
fn start_run(app: &AppHandle) {
    let state = app.state::<AppState>();
    // Claim and key under the workspace lock, so a switch cannot land between
    // them: the run either starts against the paths it was keyed for, or finds
    // them already moved and does not start at all.
    let paths = state.workspace_lock.lock().unwrap();
    let Some(claim) = claim_run(&state.syncing) else {
        return;
    };

    // Cloned before the thread starts, so the run owns its credentials even if
    // the session auto-locks a moment later. Everything else it needs is taken
    // from the session per step, and a locked session simply ends the run.
    // Dropping `claim` on the way out is what releases it: a vault that locked
    // under a scheduled run must not leave sync wedged for the process.
    let Some(cryptor) = session_cryptor(&state) else {
        return;
    };
    drop(paths);

    let app = app.clone();
    super::detached(move || {
        let _claim = claim;
        started(&app);
        report(&app, sync::run(&app, cryptor));
    });
}

fn session_cryptor(state: &State<'_, AppState>) -> Option<Cryptor> {
    state.session.lock().unwrap().cryptor().ok()
}

// Announce the result, and — when the entry list may have changed — hand the
// frontend the refreshed list. Emitting the metas rather than a bare "reload"
// signal keeps the store's update in one round trip and one render.
fn report(app: &AppHandle, result: Result<sync::engine::SyncOutcome>) {
    match result {
        Ok(outcome) => {
            if outcome.merged > 0 {
                events::vault_merged(app, entry_metas(app));
            }
            finished(app, None);
        }
        Err(e) => finished(app, Some(e.to_string())),
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

/// The process's one sync run, held for as long as this guard lives.
///
/// Owns its share of the flag rather than borrowing the state, so the claim can
/// be taken on the thread that decides to run — under `workspace_lock`, before
/// anything else can be told a run is under way — and then moved onto the thread
/// that does the running.
struct RunClaim(Arc<AtomicBool>);

/// Claim the run, or `None` if one is already in flight.
fn claim_run(syncing: &Arc<AtomicBool>) -> Option<RunClaim> {
    syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .ok()
        .map(|_| RunClaim(Arc::clone(syncing)))
}

// Releases the claim however the run ends, panics included — a wedged flag
// would disable sync for the rest of the process.
impl Drop for RunClaim {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // An import and an ordinary sync are not two flows with two flags: they
    // take the same claim, so whichever gets there first is the only one that
    // runs. Two runs at once resolve the vault id independently and can publish
    // a pack each under different ids.
    #[test]
    fn an_import_in_flight_turns_an_ordinary_run_away() {
        let state = AppState::default();

        let import = claim_run(&state.syncing).expect("nothing was running");
        assert!(
            claim_run(&state.syncing).is_none(),
            "a sync cannot start beside the import"
        );

        // However the import ended — returned, errored, or panicked — the next
        // run is free to start.
        drop(import);
        let next = claim_run(&state.syncing).expect("the import released it");
        assert!(claim_run(&state.syncing).is_none(), "and holds it in turn");
        drop(next);
        assert!(claim_run(&state.syncing).is_some());
    }
}
