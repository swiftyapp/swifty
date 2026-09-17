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
#[tauri::command]
pub async fn unlock(
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    let lockout = LockoutState::load(&app)?;
    let now = auth::now_ms();
    if lockout.locked_until_ms > now {
        return Err(Error::TooManyAttempts {
            retry_after_secs: auth::retry_after_secs(lockout.locked_until_ms, now),
        });
    }

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

// Run the Argon2id derive + SQLCipher open (both CPU-bound) on a blocking thread.
async fn unlock_off_thread(
    app: &AppHandle,
    password: String,
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
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    // This rewrites the KDF sidecar and the database through the workspace
    // paths, so it holds the same step a workspace switch has to take first.
    let _step = super::setup::begin_step(&state)?;
    // Resolved before anything is taken out of the session, so a path that
    // cannot be resolved leaves the vault open and unchanged.
    let backup = storage::db_rekey_backup_path(&app)?;

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
            &handle, store, old_key, new_key, &params, &backup,
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

    // Re-encrypt the Drive token file under the new key if present (sync parity).
    let token = storage::read_gdrive(&app).unwrap_or_default();
    if !token.is_empty() {
        if let Ok(plain) = old_cryptor.decrypt(&token) {
            storage::write_gdrive(&app, &new_key.cryptor().encrypt(&plain)?)?;
        }
    }

    // Taken before the key is handed to the session, so the re-enrollment below
    // needs no second lock to read it back.
    let stale_enrollment = storage::biometric_enrolled(&app)
        .then(|| Zeroizing::new(new_key.biometric_material().to_vec()));

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
    current: String,
    new: String,
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
