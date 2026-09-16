//! First-run onboarding: connecting Google Drive *before* a vault exists.
//!
//! Every other path through `sync` needs an unlocked session, because the OAuth
//! tokens live in a file sealed under the vault key. On a fresh install there is
//! no key and no vault, so the order has to be inverted: consent first, tokens
//! held in memory ([`AppState::pending_drive`]), and the account only written
//! down once the user's choice — restore what is up there, or start over — has
//! produced a key to seal it with.
//!
//! The connect step reports through events rather than its return value, so the
//! frontend can render "waiting for the browser" while the flow is out. Exactly
//! one of `setup:drive:probed` / `setup:drive:error` follows every
//! `setup:drive:pending` (see [`crate::events`]).

use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager, State};

use crate::crypto::VaultKey;
use crate::error::{Error, Result};
use crate::events;
use crate::models::UnlockResult;
use crate::session::{create_vault, list_metas};
use crate::state::AppState;
use crate::storage;
use crate::store::SqliteStore;
use crate::sync::{self, restore, setup::PackInfo};

// --- connect ---------------------------------------------------------------

/// Connect an account and report what it holds. Onboarding only.
///
/// Desktop: the consent flow waits on a loopback listener and the probe is a
/// network round trip, so both go to a thread of their own — the command
/// returns as soon as its guards have passed, and the frontend listens for the
/// events.
#[cfg(desktop)]
#[tauri::command]
pub fn setup_drive_connect(app: AppHandle) -> Result<()> {
    guard_no_vault(&app)?;
    ensure_idle(&app.state::<AppState>())?;
    let attempt = begin_attempt(&app.state::<AppState>());
    events::setup_drive_pending(&app);

    std::thread::spawn(move || {
        let probed = sync::obtain_tokens(&app).and_then(|mut tokens| {
            // `block_on` is legal here and only here: a plain thread is not one
            // of the async runtime's workers. Same rule as a sync run.
            let file = tauri::async_runtime::block_on(probe(&app, &mut tokens))?;
            Ok((tokens, file))
        });
        report(&app, attempt, probed);
    });
    Ok(())
}

/// The mobile twin: start consent and return — iOS suspends the app behind
/// Safari, so there is no result to wait for. [`on_consent`] finishes it.
#[cfg(mobile)]
#[tauri::command]
pub fn setup_drive_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    guard_no_vault(&app)?;
    ensure_idle(&state)?;
    begin_attempt(&state);
    crate::commands::sync::start_consent(&app, &state, crate::state::AuthPurpose::Setup)
}

/// Mobile, second half: redeem the code the deep-link handler accepted, then
/// probe — reported through the same two events as desktop. The redirect was
/// matched against `pending_auth`, which a disconnect clears, so an attempt
/// that gets this far is still the current one.
#[cfg(mobile)]
pub(crate) async fn on_consent(app: &AppHandle, code: &str, verifier: &str) {
    let attempt = current_attempt(&app.state::<AppState>());
    let probed = match sync::exchange_for_tokens(app, code, verifier).await {
        Ok(mut tokens) => {
            let file = probe(app, &mut tokens).await;
            file.map(|file| (tokens, file))
        }
        Err(e) => Err(e),
    };
    report(app, attempt, probed);
}

/// Forget the connected account. "Go back" and "switch account" are the same
/// thing to the backend: nothing was written, so nothing needs undoing — but a
/// consent still out with the browser has to be disowned too, or its tokens
/// would land in `pending_drive` after the user had already moved on.
#[tauri::command]
pub fn setup_drive_disconnect(state: State<'_, AppState>) -> Result<()> {
    ensure_idle(&state)?;
    take_pending(&state);
    abandon_attempt(&state);
    // On mobile the half-finished consent is a record, not a thread: dropping
    // it makes the redirect, if it ever comes, a stranger the handler ignores.
    #[cfg(mobile)]
    {
        let mut pending = state.pending_auth.lock().unwrap();
        if pending
            .as_ref()
            .is_some_and(|p| p.purpose == crate::state::AuthPurpose::Setup)
        {
            *pending = None;
        }
    }
    Ok(())
}

/// Does the account hold a vault? Refreshes `tokens` in place if the access
/// token consent just minted has somehow already expired.
async fn probe(app: &AppHandle, tokens: &mut sync::Tokens) -> Result<Option<PackInfo>> {
    let client = sync::http_client();
    let token = sync::fresh_access_token(&client, app, tokens).await?;
    Ok(sync::setup::find_pack(&client, &token)
        .await?
        .as_ref()
        .map(PackInfo::from))
}

/// The one ending for a connect attempt, so the frontend always hears exactly
/// one answer and the pending tokens only ever survive a success.
///
/// An attempt the user has since backed out of (or replaced) hears nothing
/// and keeps nothing: adopting its account now would silently connect a
/// fresh vault to a sign-in the user thought they had cancelled.
fn report(app: &AppHandle, attempt: u64, probed: Result<(sync::Tokens, Option<PackInfo>)>) {
    if current_attempt(&app.state::<AppState>()) != attempt {
        log::info!("drive setup: dropping a consent the user already abandoned");
        return;
    }
    match probed {
        Ok((tokens, file)) => {
            *app.state::<AppState>().pending_drive.lock().unwrap() = Some(tokens);
            events::setup_drive_probed(app, file);
        }
        Err(e) => {
            // Half a connection is worse than none — the next attempt starts
            // from consent rather than from credentials that failed once.
            take_pending(&app.state::<AppState>());
            log::warn!("drive setup failed: {e}");
            events::setup_drive_error(app, &e.to_string());
        }
    }
}

// --- restore ---------------------------------------------------------------

/// Adopt the connected account's vault as this device's, with the master
/// password it was created under.
///
/// A wrong password leaves the install exactly as it was (see
/// [`restore::restore_from_pack`]) *and* leaves the account connected, so the
/// retry costs the user nothing but the typing. No lockout bookkeeping: there
/// is no local vault to throttle guesses against yet, and the pack is Argon2id
/// + SQLCipher on its own terms.
#[tauri::command]
pub async fn setup_restore_from_drive(
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    guard_no_vault(&app)?;
    let _step = begin_step(&state)?;
    let mut tokens = peek_pending(&state)?;

    let bytes = download(&app, &mut tokens).await?;
    // Whatever the download's refresh produced has to be kept: Google rotates
    // refresh tokens, and a retry after a mistyped password uses these again.
    *state.pending_drive.lock().unwrap() = Some(tokens.clone());

    let (key, store) = restore_off_thread(&app, bytes, password).await?;
    adopt(&app, &state, key, store, Some(&tokens))
}

/// Restore from a `.rowel` backup on disk. Onboarding only.
///
/// The same pack the sync engine uploads, written by `export_vault` instead of
/// pulled from Drive — so this is [`setup_restore_from_drive`] with the
/// download swapped for a file read, and no account to keep afterwards. The
/// read shares the blocking thread with the restore: a backup is the whole
/// vault, and a large one on a slow disk must not stall the async runtime. No
/// size cap, for the same reason the Drive download has none — the pack's own
/// structural checks (`pack::unpack`) are what reject a file that is not one.
#[tauri::command]
pub async fn setup_restore_from_file(
    path: String,
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    guard_no_vault(&app)?;
    let _step = begin_step(&state)?;

    let handle = app.clone();
    let (key, store) = tauri::async_runtime::spawn_blocking(move || {
        let bytes = std::fs::read(&path)?;
        restore::restore_from_pack(&handle, &bytes, &password)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))??;
    adopt(&app, &state, key, store, None)
}

/// Fetch the account's pack, re-locating it rather than trusting the id the
/// probe saw: the two are minutes apart, and a stale id is a confusing failure
/// where "no vault up there any more" is a clear one.
async fn download(app: &AppHandle, tokens: &mut sync::Tokens) -> Result<Vec<u8>> {
    let client = sync::http_client();
    let token = sync::fresh_access_token(&client, app, tokens).await?;
    let file = sync::setup::find_pack(&client, &token)
        .await?
        .ok_or(Error::NoRemoteVault)?;
    sync::setup::download_pack(&client, &token, &file.id).await
}

// Argon2id + a SQLCipher open, both CPU-bound: off the command thread, as unlock does.
async fn restore_off_thread(
    app: &AppHandle,
    bytes: Vec<u8>,
    password: String,
) -> Result<(VaultKey, SqliteStore)> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        restore::restore_from_pack(&app, &bytes, &password)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

// --- create ----------------------------------------------------------------

/// Create a new vault, turning sync on if an account was connected first.
///
/// With no pending account this is exactly `setup`: a fresh vault, sync off.
/// With one, the credentials are sealed under the new key and the session is
/// marked connected — the frontend's `enterMain` runs the first sync, which is
/// what creates the folder and the pack on Drive.
#[tauri::command]
pub async fn setup_create(
    password: String,
    archive_remote: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    // `create_vault` writes a fresh KDF sidecar before it opens the database,
    // so running it over an existing vault would leave that vault unopenable.
    guard_no_vault(&app)?;
    let _step = begin_step(&state)?;
    let mut tokens = state.pending_drive.lock().unwrap().clone();

    // Before the vault is created, not after: if Drive refuses, the user is
    // left on a still-fresh install to try again, rather than holding a new
    // vault whose first sync is about to overwrite the pack they asked to keep.
    if archive_remote {
        if let Some(tokens) = tokens.as_mut() {
            archive(&app, tokens).await?;
        }
    }

    let (key, store) = create_off_thread(&app, password).await?;
    adopt(&app, &state, key, store, tokens.as_ref())
}

/// Move the account's existing pack aside, if it has one. Nothing up there is
/// not a failure — it is the common case, and the same outcome either way.
async fn archive(app: &AppHandle, tokens: &mut sync::Tokens) -> Result<()> {
    let client = sync::http_client();
    let token = sync::fresh_access_token(&client, app, tokens).await?;
    let Some(file) = sync::setup::find_pack(&client, &token).await? else {
        return Ok(());
    };
    sync::setup::archive_pack(&client, &token, &file.id, &sync::setup::today_utc()).await
}

// Argon2id + creating the encrypted DB: CPU-bound, same as the restore path.
// Shared with `commands::workspace`, which creates a vault the same way.
pub(crate) async fn create_off_thread(
    app: &AppHandle,
    password: String,
) -> Result<(VaultKey, SqliteStore)> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || create_vault(&app, &password))
        .await
        .map_err(|e| Error::Other(e.to_string()))?
}

// --- shared ----------------------------------------------------------------

/// Make a vault that has just landed on disk this device's: seal the pending
/// account under its key, open the session, forget the pending copy.
///
/// All or nothing. The vault is already committed when this runs, so a failure
/// here — the token file not writing, the store not listing — would otherwise
/// leave a vault on disk with no session behind it and `guard_no_vault`
/// refusing every retry: an install the user can neither finish nor start
/// over. Removing what was just written puts them back on a fresh install,
/// where the retry is one press away. (The remote pack an archive already
/// renamed stays renamed; nothing about that is lost.)
fn adopt(
    app: &AppHandle,
    state: &AppState,
    key: VaultKey,
    store: SqliteStore,
    tokens: Option<&sync::Tokens>,
) -> Result<UnlockResult> {
    // Metadata first, tokens last: nothing else is written until the one read
    // that could fail has succeeded, so a failure here leaves no token file
    // sealed under a key that is about to be discarded.
    let installed = list_metas(&store).and_then(|entries| {
        if let Some(tokens) = tokens {
            sync::persist_tokens(app, &key.cryptor(), tokens)?;
        }
        Ok(entries)
    });
    match installed {
        Ok(entries) => {
            let sync_configured = tokens.is_some();
            state
                .session
                .lock()
                .unwrap()
                .set(key, store, sync_configured);
            take_pending(state);
            Ok(UnlockResult {
                entries,
                sync_configured,
            })
        }
        Err(e) => {
            // The connection has to close before its files can go.
            drop(store);
            discard_fresh_vault(app);
            Err(e)
        }
    }
}

/// Undo `create_vault` / `restore_from_pack`: remove the database (with its
/// WAL siblings) and the KDF sidecar, in that order — a sidecar without a
/// database is harmless, a database without its sidecar reads as "wrong
/// password" forever. The token file goes too: the write that failed may have
/// left part of one behind, sealed under a key that no longer exists, and a
/// non-empty file there is what `sync_configured` reads as "syncing".
fn discard_fresh_vault(app: &AppHandle) {
    if let Ok(path) = storage::db_path(app) {
        storage::remove_db_files(&path);
    }
    if let Ok(path) = storage::kdf_sidecar_path(app) {
        let _ = std::fs::remove_file(path);
    }
    storage::remove_gdrive(app);
}

/// Refuse to touch the pending account while a create or restore is using it.
///
/// A restore clones the tokens before its network and Argon2 work, so a
/// disconnect (or a fresh connect) landing mid-way could not stop it — it
/// would finish and seal the vault to the account the user had just left.
/// The step already excludes other steps; this excludes the account changing
/// under one.
fn ensure_idle(state: &AppState) -> Result<()> {
    if state.setup_busy.load(Ordering::SeqCst) {
        return Err(Error::SetupBusy);
    }
    Ok(())
}

/// Hold `setup_busy` for the length of one create or restore.
///
/// `guard_no_vault` looks before the write; this makes sure nothing else
/// writes in between. Two overlapping requests would each write their own
/// KDF sidecar and database, and whichever finished second would pair a
/// database with the other's descriptor — a vault nobody's password opens.
pub(crate) struct SetupStep<'a>(&'a AppState);

// Also held by `workspace_create`, which writes the same two files.
pub(crate) fn begin_step(state: &AppState) -> Result<SetupStep<'_>> {
    state
        .setup_busy
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| Error::SetupBusy)?;
    Ok(SetupStep(state))
}

impl Drop for SetupStep<'_> {
    fn drop(&mut self) {
        self.0.setup_busy.store(false, Ordering::SeqCst);
    }
}

/// Start a connect attempt; the number identifies it to [`report`].
fn begin_attempt(state: &AppState) -> u64 {
    state.setup_attempt.fetch_add(1, Ordering::SeqCst) + 1
}

/// Disown whatever attempt is in flight: its `report` will find itself stale.
fn abandon_attempt(state: &AppState) {
    state.setup_attempt.fetch_add(1, Ordering::SeqCst);
}

fn current_attempt(state: &AppState) -> u64 {
    state.setup_attempt.load(Ordering::SeqCst)
}

/// Onboarding only. A device that already holds a vault has other routes to
/// Drive (`sync_connect`, `sync_import`), and every one of them merges rather
/// than replaces — which is the point: nothing here may be reachable in a way
/// that could overwrite a vault this device already has.
fn guard_no_vault(app: &AppHandle) -> Result<()> {
    if storage::db_exists(app) {
        return Err(Error::AlreadySetUp);
    }
    Ok(())
}

/// The connected account's tokens, left in place for a retry.
fn peek_pending(state: &AppState) -> Result<sync::Tokens> {
    state
        .pending_drive
        .lock()
        .unwrap()
        .clone()
        .ok_or(Error::DriveNotConnected)
}

/// Forget the connected account, if there is one.
fn take_pending(state: &AppState) -> Option<sync::Tokens> {
    state.pending_drive.lock().unwrap().take()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens(access: &str) -> sync::Tokens {
        sync::Tokens {
            access_token: Some(access.into()),
            refresh_token: Some("refresh".into()),
            expires_at: Some(4_102_444_800),
        }
    }

    // A fresh install has connected nothing, so restore has nothing to ask for
    // — and says so in words the onboarding screen can show.
    #[test]
    fn nothing_is_pending_until_an_account_is_connected() {
        let state = AppState::default();
        assert!(matches!(
            peek_pending(&state),
            Err(Error::DriveNotConnected)
        ));
        assert!(take_pending(&state).is_none());
    }

    // Peek leaves the account connected (a mistyped master password must be
    // retryable), take ends it (that is what "go back" means).
    #[test]
    fn peeking_keeps_the_account_and_taking_ends_it() {
        let state = AppState::default();
        *state.pending_drive.lock().unwrap() = Some(tokens("first"));

        assert_eq!(
            peek_pending(&state).unwrap().access_token.as_deref(),
            Some("first")
        );
        assert_eq!(
            peek_pending(&state).unwrap().access_token.as_deref(),
            Some("first")
        );

        assert_eq!(
            take_pending(&state).unwrap().access_token.as_deref(),
            Some("first")
        );
        assert!(peek_pending(&state).is_err());
    }

    // "Switch account" is disconnect + connect: the second consent replaces the
    // first outright, so no stale credentials can be used by mistake.
    #[test]
    fn connecting_again_replaces_the_account() {
        let state = AppState::default();
        *state.pending_drive.lock().unwrap() = Some(tokens("first"));
        *state.pending_drive.lock().unwrap() = Some(tokens("second"));
        assert_eq!(
            take_pending(&state).unwrap().access_token.as_deref(),
            Some("second")
        );
    }

    // Two creates (or a create and a restore) cannot both be writing the vault:
    // the second is turned away, and the way is clear again once the first is
    // done — however it ended.
    #[test]
    fn only_one_setup_step_writes_at_a_time() {
        let state = AppState::default();
        let step = begin_step(&state).unwrap();
        assert!(matches!(begin_step(&state), Err(Error::SetupBusy)));
        drop(step);
        assert!(begin_step(&state).is_ok());
    }

    // While a create or restore holds the account, nothing may swap it out
    // from under it — a disconnect then would not stop the restore, only make
    // it finish against an account the user thought they had left.
    #[test]
    fn the_account_cannot_change_while_a_step_is_using_it() {
        let state = AppState::default();
        assert!(ensure_idle(&state).is_ok());

        let step = begin_step(&state).unwrap();
        assert!(matches!(ensure_idle(&state), Err(Error::SetupBusy)));

        drop(step);
        assert!(ensure_idle(&state).is_ok());
    }

    // A consent the user backed out of comes back stale: `report` compares the
    // number it was started with against the current one.
    #[test]
    fn backing_out_disowns_the_attempt_in_flight() {
        let state = AppState::default();
        let attempt = begin_attempt(&state);
        assert_eq!(current_attempt(&state), attempt);

        abandon_attempt(&state);
        assert_ne!(current_attempt(&state), attempt);

        // ...and the next connect is its own attempt, distinct from both.
        let next = begin_attempt(&state);
        assert_ne!(next, attempt);
        assert_eq!(current_attempt(&state), next);
    }

    // The event names are the frontend's contract.
    #[test]
    fn the_onboarding_events_keep_their_names() {
        assert_eq!(events::SETUP_DRIVE_PENDING, "setup:drive:pending");
        assert_eq!(events::SETUP_DRIVE_PROBED, "setup:drive:probed");
        assert_eq!(events::SETUP_DRIVE_ERROR, "setup:drive:error");
    }
}
