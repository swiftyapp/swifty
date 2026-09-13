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
//! one of [`PROBED_EVENT`] / [`ERROR_EVENT`] follows every [`PENDING_EVENT`].

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::{create_vault, list_metas};
use crate::crypto::VaultKey;
use crate::error::{Error, Result};
use crate::models::UnlockResult;
use crate::state::AppState;
use crate::storage;
use crate::store::SqliteStore;
use crate::sync::{self, restore, setup::PackInfo};

/// The browser is out and the app is waiting on consent.
pub(crate) const PENDING_EVENT: &str = "setup:drive:pending";
/// Connected, and here is what the account holds (`{ file: … | null }`).
const PROBED_EVENT: &str = "setup:drive:probed";
/// The flow ended without a connection (`{ error: String }`).
const ERROR_EVENT: &str = "setup:drive:error";

// User-facing, so deliberately plain about what to do next.
const NOT_CONNECTED: &str = "connect a Google account first";
const NO_REMOTE_VAULT: &str = "this Google account has no Swifty data to restore";
const ALREADY_SET_UP: &str = "this device is already set up";

// --- connect ---------------------------------------------------------------

/// Connect an account and report what it holds. Onboarding only.
///
/// Desktop: the consent flow blocks on a loopback listener and the probe is a
/// network round trip, so both go to a blocking thread — the command itself
/// returns as soon as they are scheduled, and the frontend listens for the
/// events.
#[cfg(desktop)]
#[tauri::command]
pub async fn setup_drive_connect(app: AppHandle) -> Result<()> {
    guard_no_vault(&app)?;
    let _ = app.emit(PENDING_EVENT, ());

    let handle = app.clone();
    let probed = tauri::async_runtime::spawn_blocking(move || {
        let mut tokens = sync::obtain_tokens(&handle)?;
        // `block_on` is legal here and only here: a blocking thread is not one
        // of the async runtime's workers. Same rule as a sync run.
        let file = tauri::async_runtime::block_on(probe(&handle, &mut tokens))?;
        Ok((tokens, file))
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?;

    report(&app, probed);
    Ok(())
}

/// The mobile twin: start consent and return — iOS suspends the app behind
/// Safari, so there is no result to wait for. [`on_consent`] finishes it.
#[cfg(mobile)]
#[tauri::command]
pub fn setup_drive_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    guard_no_vault(&app)?;
    crate::commands::sync::start_consent(&app, &state, crate::state::AuthPurpose::Setup)
}

/// Mobile, second half: redeem the code the deep-link handler accepted, then
/// probe — reported through the same two events as desktop.
#[cfg(mobile)]
pub(crate) async fn on_consent(app: &AppHandle, code: &str, verifier: &str) {
    let probed = match sync::exchange_for_tokens(app, code, verifier).await {
        Ok(mut tokens) => {
            let file = probe(app, &mut tokens).await;
            file.map(|file| (tokens, file))
        }
        Err(e) => Err(e),
    };
    report(app, probed);
}

/// Forget the connected account. "Go back" and "switch account" are the same
/// thing to the backend: nothing was written, so nothing needs undoing.
#[tauri::command]
pub fn setup_drive_disconnect(state: State<'_, AppState>) -> Result<()> {
    take_pending(&state);
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
fn report(app: &AppHandle, probed: Result<(sync::Tokens, Option<PackInfo>)>) {
    match probed {
        Ok((tokens, file)) => {
            *app.state::<AppState>().pending_drive.lock().unwrap() = Some(tokens);
            let _ = app.emit(PROBED_EVENT, json!({ "file": file }));
        }
        Err(e) => {
            // Half a connection is worse than none — the next attempt starts
            // from consent rather than from credentials that failed once.
            take_pending(&app.state::<AppState>());
            log::warn!("drive setup failed: {e}");
            emit_error(app, &e.to_string());
        }
    }
}

pub(crate) fn emit_error(app: &AppHandle, why: &str) {
    let _ = app.emit(ERROR_EVENT, json!({ "error": why }));
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
    let mut tokens = peek_pending(&state)?;

    let bytes = download(&app, &mut tokens).await?;
    // Whatever the download's refresh produced has to be kept: Google rotates
    // refresh tokens, and a retry after a mistyped password uses these again.
    *state.pending_drive.lock().unwrap() = Some(tokens.clone());

    let (key, store) = restore_off_thread(&app, bytes, password).await?;

    // Only now is there a key to seal the credentials under — the whole reason
    // they were carried in memory to this point.
    sync::persist_tokens(&app, &key.cryptor(), &tokens)?;
    let entries = list_metas(&store)?;
    state.session.lock().unwrap().set(key, store, true);
    take_pending(&state);

    Ok(UnlockResult {
        entries,
        sync_configured: true,
    })
}

/// Fetch the account's pack, re-locating it rather than trusting the id the
/// probe saw: the two are minutes apart, and a stale id is a confusing failure
/// where "no vault up there any more" is a clear one.
async fn download(app: &AppHandle, tokens: &mut sync::Tokens) -> Result<Vec<u8>> {
    let client = sync::http_client();
    let token = sync::fresh_access_token(&client, app, tokens).await?;
    let file = sync::setup::find_pack(&client, &token)
        .await?
        .ok_or_else(|| Error::Other(NO_REMOTE_VAULT.into()))?;
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
    let sync_configured = match &tokens {
        Some(tokens) => {
            sync::persist_tokens(&app, &key.cryptor(), tokens)?;
            true
        }
        None => false,
    };
    state
        .session
        .lock()
        .unwrap()
        .set(key, store, sync_configured);
    take_pending(&state);

    Ok(UnlockResult {
        entries: Vec::new(),
        sync_configured,
    })
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
async fn create_off_thread(app: &AppHandle, password: String) -> Result<(VaultKey, SqliteStore)> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || create_vault(&app, &password))
        .await
        .map_err(|e| Error::Other(e.to_string()))?
}

// --- shared ----------------------------------------------------------------

/// Onboarding only. A device that already holds a vault has other routes to
/// Drive (`sync_connect`, `sync_import`), and every one of them merges rather
/// than replaces — which is the point: nothing here may be reachable in a way
/// that could overwrite a vault this device already has.
fn guard_no_vault(app: &AppHandle) -> Result<()> {
    if storage::db_exists(app) {
        return Err(Error::Other(ALREADY_SET_UP.into()));
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
        .ok_or_else(|| Error::Other(NOT_CONNECTED.into()))
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
        match peek_pending(&state) {
            Err(Error::Other(why)) => assert_eq!(why, NOT_CONNECTED),
            other => panic!("{:?}", other.map(|_| ())),
        }
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

    // The event names are the frontend's contract, and a probe always names the
    // `file` key — `null` is an answer, not an absence.
    #[test]
    fn the_probe_payload_names_the_file_or_null() {
        assert_eq!(PENDING_EVENT, "setup:drive:pending");
        assert_eq!(PROBED_EVENT, "setup:drive:probed");
        assert_eq!(ERROR_EVENT, "setup:drive:error");

        let none: Option<PackInfo> = None;
        assert_eq!(json!({ "file": none }), json!({ "file": null }));
    }
}
