//! Unlocking, locking, the biometric enrollment and the master-password change.
//!
//! Thin entry points: the backoff and the rekey saga live in [`crate::auth`],
//! the vault-opening helpers in [`crate::session`]. What is left here is the
//! part that has to touch the session — and every one of these commands is
//! `async` so that the work behind it can go to the blocking pool, because a
//! non-async command body runs on the IPC (main) thread.

use crate::auth::{self, LockoutState};
use crate::crypto::{KdfParams, VaultKey};
use crate::error::{Error, Result};
use crate::models::{EntryMetaDto, UnlockResult};
use crate::secure_store::{self, GateMode, KeyStore};
use crate::session::{derive_key, open_with_key, unlock_with_password};
use crate::state::AppState;
use crate::store::SqliteStore;
use crate::{biometrics, crypto, events, storage};
use tauri::{AppHandle, State};
use zeroize::Zeroizing;

use super::blocking;

// Unlock with the master password: read the KDF sidecar, derive the key, open the
// existing store, and return the entry metadata list. The Argon2id derive + the
// SQLCipher open both run on a blocking thread so the UI is never stalled; unlock
// never migrates anything.
//
// Wrapped with the failed-unlock backoff (T-AUTH-3): a standing lockout is
// enforced *before* deriving anything (so a locked-out caller never pays the
// Argon2id cost), and a wrong password updates the lockout sidecar afterwards.
//
// The password arrives as `Zeroizing<String>`: deserialized straight into a
// buffer that is scrubbed when it drops, so the plaintext does not outlive the
// derive on whatever heap block the allocator gave it.
#[tauri::command]
pub async fn unlock(
    password: Zeroizing<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    // Held for the whole unlock, like `change_master_password` holds it for the
    // whole change. Without it an unlock could land while a change is still
    // re-keying (an auto-lock during a long change ends the session but not the
    // saga), and the recovery below would read that change's snapshot as an
    // interrupted one and copy it over a database the saga still has open.
    let _step = super::setup::begin_step(&state)?;
    // Before the lockout check and before anything reads the sidecar: a crash
    // during a password change can leave the DB and the sidecar disagreeing, and
    // the rollback has to land before either is consulted.
    auth::recover_interrupted_rekey(&app, &state)?;

    let lockout = LockoutState::load(&app)?;
    let now = auth::now_ms();
    if lockout.locked_until_ms > now {
        return Err(Error::TooManyAttempts {
            retry_after_secs: auth::retry_after_secs(lockout.locked_until_ms, now),
        });
    }

    // A second copy of the password, for the one thing that may outlive the
    // unlock: trying it against the account's other vaults
    // (`commands::autojoin`). Only for a vault that syncs — a local vault has
    // no account to look in — and only once the unlock has succeeded.
    let join = storage::sync_configured(&app).then(|| password.clone());

    match unlock_off_thread(&app, password).await {
        Ok((key, store, entries)) => {
            if lockout != LockoutState::default() {
                if let Err(e) = LockoutState::default().save(&app) {
                    log::warn!("failed to reset lockout sidecar: {e}");
                }
            }
            let sync_configured = storage::sync_configured(&app);
            state
                .session
                .lock()
                .unwrap()
                .set(key, store, sync_configured);
            // The idle clock starts with the session, not with the frontend's
            // first activity ping: a webview that never sends one (a build
            // whose bundle failed, a page left untouched) would otherwise leave
            // the vault open for good.
            crate::autolock::touch(&app);
            seed_vault_name(&app, &state);
            if let Some(password) = join {
                super::autojoin::with_password(&app, password);
            }
            Ok(UnlockResult {
                entries,
                sync_configured,
            })
        }
        Err(Error::InvalidPassword) => {
            let updated = auth::record_failed_attempt(lockout, now);
            if let Err(e) = updated.save(&app) {
                log::warn!("failed to persist lockout sidecar: {e}");
            }
            if updated.locked_until_ms > now {
                Err(Error::TooManyAttempts {
                    retry_after_secs: auth::retry_after_secs(updated.locked_until_ms, now),
                })
            } else {
                Err(Error::InvalidPassword)
            }
        }
        Err(e) => Err(e),
    }
}

// A vault named before the name lived inside it: copy the registry's label into
// `meta` so the first sync publishes it instead of leaving the user's other
// devices unnamed. A workspace with no label keeps none — the frontend goes on
// showing its translated default.
//
// Stamped `MIGRATED_NAME_MS`, never `now`: the label predates stamps entirely,
// so it says nothing about when the user chose it. Stamping it now would let a
// device that upgrades late in a rollout outrank a rename another device has
// already published — the migrated label must lose to every real rename, and
// win only against a vault nobody has named.
//
// Best effort, and the registry is read before the session lock is taken, since
// that is the order every other reader of the two takes them in.
fn seed_vault_name(app: &AppHandle, state: &AppState) {
    let Some(name) = crate::workspace::active_name(app) else {
        return;
    };
    let session = state.session.lock().unwrap();
    let Ok(store) = session.store() else {
        return;
    };
    if !matches!(crate::store::identity::vault_name(store), Ok((None, _))) {
        return;
    }
    if let Err(e) = crate::store::identity::set_vault_name(
        store,
        &name,
        crate::store::identity::MIGRATED_NAME_MS,
    ) {
        log::warn!("could not seed the vault name from the registry: {e}");
    }
}

// Run the Argon2id derive + SQLCipher open (both CPU-bound) on a blocking thread.
async fn unlock_off_thread(
    app: &AppHandle,
    password: Zeroizing<String>,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let app = app.clone();
    blocking(move || unlock_with_password(&app, &password)).await
}

// Open the store for an already-resolved key (biometric path) off the UI thread.
async fn open_off_thread(
    app: &AppHandle,
    key: VaultKey,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let app = app.clone();
    blocking(move || {
        let (store, entries) = open_with_key(&app, &key)?;
        Ok((key, store, entries))
    })
    .await
}

// Clear the in-memory key and close the store, and emit `vault:locked` with it
// — the frontend reacts to the event, not to this promise (see `session::lock`).
// Announced even when there was nothing left to seal: the user asked for the
// lock screen, and a webview that somehow still shows the vault gets it.
#[tauri::command]
pub fn lock(app: AppHandle) -> Result<()> {
    if !crate::session::lock(&app) {
        events::vault_locked(&app);
    }
    Ok(())
}

// The user is at the keyboard: restart the inactivity clock. The webview sends
// this throttled off its own input events (`useActivityPing`), once on mount
// and then at most every few seconds while the user is active; the auto-lock
// comes due that long after the last one. Cheap and side-effect free on a
// locked vault, so it needs no guard.
#[tauri::command]
pub fn touch_activity(app: AppHandle) -> Result<()> {
    crate::autolock::touch(&app);
    Ok(())
}

// Unlock from a locked start using the biometric-gated key in the OS secure
// store. Retrieving the key triggers the biometric prompt; the sidecar decides
// how to interpret the stored bytes (Argon2id master vs legacy secret). The
// store then opens off the UI thread. No migration on unlock.
#[tauri::command]
pub async fn unlock_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<UnlockResult> {
    // Same two reasons as in `unlock`: no unlock while a change is re-keying,
    // and an interrupted change rolled back before the sidecar decides how to
    // read the stored material.
    let _step = super::setup::begin_step(&state)?;
    auth::recover_interrupted_rekey(&app, &state)?;

    let Some(marker) = storage::biometric_marker(&app) else {
        return Err(Error::Other("biometric unlock is not enabled".into()));
    };
    // Read through the gate enrollment recorded, never a re-probed one: trying
    // the other mode on failure would either downgrade an OS-enforced gate to an
    // app-enforced one behind the user's back, or just miss.
    //
    // On the blocking pool, like the open two lines below: the retrieve puts a
    // system biometric sheet on screen and waits for it on a channel, so it
    // parks its thread for as long as the user takes to answer.
    let mode = GateMode::from_marker(&marker);
    let material = match blocking(move || secure_store::Platform.retrieve(mode)).await {
        Ok(k) => k,
        Err(e) => {
            if unenroll_on(&e) {
                let _ = storage::set_biometric_marker(&app, None);
            }
            return Err(e);
        }
    };
    // A sidecar means the stored bytes are an Argon2id master; without one they
    // are the legacy secret string (a pre-sidecar dev vault).
    let key = match storage::read_kdf_sidecar(&app)? {
        Some(_) => VaultKey::Argon2 { master: material },
        None => VaultKey::Legacy { secret: material },
    };
    let (key, store, entries) = open_off_thread(&app, key).await?;
    let sync_configured = storage::sync_configured(&app);
    state
        .session
        .lock()
        .unwrap()
        .set(key, store, sync_configured);
    // As in `unlock`: the session arms its own idle clock, and a vault named
    // before names lived inside it takes the registry's label.
    crate::autolock::touch(&app);
    seed_vault_name(&app, &state);
    Ok(UnlockResult {
        entries,
        sync_configured,
    })
}

// Whether a failed biometric retrieve means the enrollment itself is gone and
// the marker should be cleared.
//
// Only [`Error::NotFound`] qualifies: the keychain item is provably absent (the
// OS invalidated it because the enrolled fingerprints changed, or the user
// removed it), so keeping the marker would leave a Touch ID button that can
// never work. Every other failure — a build that lost its code-signing
// entitlement, a cancelled prompt, a transient keychain error — leaves the key
// sitting in the keychain intact, so un-enrolling would turn a temporary
// problem into a permanent one and force the user to re-enroll for nothing.
fn unenroll_on(err: &Error) -> bool {
    matches!(err, Error::NotFound)
}

// Opt in: store the current session's key material in the OS secure store,
// biometry-gated. Requires an unlocked vault. Returns the gate that enrollment
// settled on — recorded here and honoured verbatim by every later retrieval.
#[tauri::command]
pub async fn enable_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<String> {
    crate::workspace::guard_primary(&app)?;
    if !secure_store::is_supported() || !biometrics::is_available() {
        return Err(Error::Other("biometrics not available".into()));
    }
    // Copied out from under the guard, because the write below is a blocking
    // call into the OS keychain (and a gated one on macOS) — precisely what the
    // session lock may not be held across. `Zeroizing` so the copy is scrubbed.
    let material = biometric_material(&state)?;
    let mode = blocking(move || secure_store::Platform.store(&material)).await?;
    storage::set_biometric_marker(&app, Some(mode.as_marker()))?;
    Ok(mode.as_marker().to_string())
}

// Opt out: delete the stored key (in every mode) and clear the marker.
#[tauri::command]
pub async fn disable_biometric(app: AppHandle) -> Result<()> {
    blocking(move || secure_store::Platform.delete()).await?;
    storage::set_biometric_marker(&app, None)?;
    Ok(())
}

// The session key's opaque bytes, as a scrubbed copy the blocking pool can own.
fn biometric_material(state: &State<'_, AppState>) -> Result<Zeroizing<Vec<u8>>> {
    let session = state.session.lock().unwrap();
    Ok(Zeroizing::new(session.key()?.biometric_material().to_vec()))
}

// Re-derive a fresh Argon2id key (new salt), re-seal every payload under the new
// payload key, re-key the encrypted DB and rewrite the sidecar. Requires an
// unlocked session. The saga itself is [`crate::auth::rekey`]; this is the part
// that has to touch the session.
//
// Nothing expensive happens under the session lock. Both Argon2id derives run
// before it is taken, and the saga runs on the blocking pool with the store
// *out* of the session — so for its duration every other command reads the
// session as `Error::Locked` rather than waiting behind a mutex held across a
// whole-vault re-seal. The frontend has no window to observe that in: it awaits
// this command and does not poll while it is in flight.
#[tauri::command]
pub async fn change_master_password(
    current: Zeroizing<String>,
    new: Zeroizing<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    // This rewrites the KDF sidecar and the database through the workspace
    // paths, so it holds the same step a workspace switch has to take first —
    // and that every unlock takes, so no unlock can run recovery against the
    // snapshot this change is about to publish.
    let _step = super::setup::begin_step(&state)?;
    // Resolved before anything is taken out of the session, so a path that
    // cannot be resolved leaves the vault open and unchanged.
    let paths = auth::RekeyPaths::resolve(&app, &state)?;

    // Deriving needs only the app handle and the passwords, so it happens off
    // the session entirely — and off the main thread, since Argon2id is the
    // single most expensive thing this app does.
    let (current_key, new_key, params) = derive_both(&app, current, new).await?;

    // Take the key and store out on a lease for the duration. A lock that lands
    // while they are away — the user's, or the auto-lock's, which sees the
    // vault as live throughout — ends the session, and `adopt` below refuses
    // to put the vault back on top of it.
    let lease = {
        let mut session = state.session.lock().unwrap();
        // Verify the current password reproduces the unlocked session key.
        if current_key.sqlcipher_key() != session.key()?.sqlcipher_key() {
            return Err(Error::InvalidPassword);
        }
        session.take_out()?
    };
    let (old_key, store, sync_configured, claim) = lease.split();
    // The Drive token is sealed under the *old* key and has to be re-sealed
    // after the change; the key itself is about to be moved into the saga.
    let old_cryptor = old_key.cryptor();

    let handle = app.clone();
    let rekeyed = blocking(move || {
        Ok(auth::rekey(
            &handle, store, old_key, new_key, &params, &paths,
        ))
    })
    .await?;

    let (new_key, store) = match rekeyed {
        Ok(changed) => changed,
        Err(rollback) => {
            match rollback.restored {
                // Back as it was — unless a lock landed meanwhile, in which
                // case the vault stays locked and the reopened store is dropped.
                Some((key, store)) => {
                    state
                        .session
                        .lock()
                        .unwrap()
                        .adopt(claim, key, store, sync_configured);
                }
                // Even the rollback could not reopen the vault: there is no
                // session to hand back, so it ends, and the webview is told
                // rather than left looking at a vault that is no longer open.
                None => {
                    crate::session::lock(&app);
                }
            }
            return Err(rollback.error);
        }
    };

    // Both taken before the key is handed to the session, so what follows needs
    // no second lock to read them back.
    let stale_enrollment = storage::biometric_enrolled(&app)
        .then(|| Zeroizing::new(new_key.biometric_material().to_vec()));
    let new_cryptor = new_key.cryptor();

    // Adopt the new key + store as the continuation of the session the lease
    // came from. Refused when a lock landed while the saga ran: the change is
    // on disk either way and the next unlock takes the new password, but the
    // vault stays locked rather than reopening behind the user's back.
    let adopted = state
        .session
        .lock()
        .unwrap()
        .adopt(claim, new_key, store, sync_configured);
    if !adopted {
        log::info!(
            "vault locked during the password change; the new key waits for the next unlock"
        );
    }

    // Re-encrypt the Drive token file under the new key if present (sync parity).
    // After the adopt and best-effort on purpose: the password change is already
    // committed on disk, so failing out here would strand the session held-out
    // with no `vault:locked` event and leave the biometric enrollment stale. The
    // worst case is a token the user has to reconnect.
    if let Err(e) = crate::sync::reseal_tokens(&app, &old_cryptor, &new_cryptor) {
        log::warn!("could not re-seal the Drive token under the new key: {e}");
    }

    // The biometric-stored key is now stale; re-store the new material or clear
    // it. Re-storing is a fresh enrollment, so the gate is decided again and the
    // marker refreshed — a build that has since gained (or lost) its entitlement
    // moves the key to the matching mode instead of leaving a mislabelled item.
    if let Some(material) = stale_enrollment {
        match blocking(move || secure_store::Platform.store(&material)).await {
            Ok(mode) => {
                let _ = storage::set_biometric_marker(&app, Some(mode.as_marker()));
            }
            Err(_) => {
                let _ = blocking(|| secure_store::Platform.delete()).await;
                let _ = storage::set_biometric_marker(&app, None);
            }
        }
    }
    Ok(())
}

// Both Argon2id derives, on the blocking pool and before the session lock is
// taken. The current password's key is checked against the session afterwards;
// the new one gets fresh params (a new salt), and nothing on disk is touched
// here, so a failure costs nothing but the error.
async fn derive_both(
    app: &AppHandle,
    current: Zeroizing<String>,
    new: Zeroizing<String>,
) -> Result<(VaultKey, VaultKey, KdfParams)> {
    let app = app.clone();
    blocking(move || {
        let current_key = derive_key(&app, &current)?;
        let params = KdfParams::default_argon2id();
        let new_key = VaultKey::Argon2 {
            master: crypto::derive(new.as_bytes(), &params)?,
        };
        Ok((current_key, new_key, params))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_keychain_item_un_enrolls() {
        assert!(unenroll_on(&Error::NotFound));
    }

    #[test]
    fn an_unreadable_but_present_key_keeps_the_enrollment() {
        // The entitlement error the protected gate raises in an unsigned build,
        // plus the everyday failures. None of these mean the key is gone.
        for err in [
            Error::Other("this build is not entitled to read the protected keychain item".into()),
            Error::Other("biometric authentication failed".into()),
            Error::Cancelled,
            Error::Locked,
        ] {
            assert!(!unenroll_on(&err), "{err} must not clear the marker");
        }
    }
}
