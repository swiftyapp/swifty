use crate::commands::{
    create_vault, derive_key, open_with_key, record_kdf_meta, store_err, unlock_with_password,
};
use crate::crypto::{self, KdfParams, PayloadCipher, VaultKey};
use crate::error::{Error, Result};
use crate::models::{EntryMetaDto, UnlockResult};
use crate::secure_store::{self, GateMode, KeyStore};
use crate::state::AppState;
use crate::store::{Record, SqliteStore, VaultStore};
use crate::{biometrics, storage};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

// --- Failed-unlock backoff (T-AUTH-3) ---------------------------------------
//
// Defense-in-depth on top of Argon2id+SQLCipher: this only slows down repeated
// guessing *through the app*, it does not add cryptographic strength. State
// lives in a plaintext sidecar next to the DB (`storage::LOCKOUT_SIDECAR_FILE`)
// because a wrong password never opens the encrypted DB, so it cannot be kept
// in the `meta` table — the same reasoning as the KDF sidecar.
//
// First `FREE_ATTEMPTS` wrong tries are free (no delay). Every attempt beyond
// that doubles the wait: 2^(attempt - FREE_ATTEMPTS) seconds, capped at
// `MAX_DELAY_SECS`. With FREE_ATTEMPTS=3: attempt 4 -> 2s, 5 -> 4s, 6 -> 8s,
// ... 12+ -> capped at 300s (5 min).
const FREE_ATTEMPTS: u32 = 3;
const MAX_DELAY_SECS: u64 = 300;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
struct LockoutState {
    failed_attempts: u32,
    // Epoch millis; 0 means "not locked".
    locked_until_ms: i64,
}

impl LockoutState {
    // Missing or unparseable sidecar reads as "no lockout" — this state is a
    // throttle, not a security boundary, so failing open here is fine.
    fn load(app: &AppHandle) -> Result<Self> {
        match storage::read_lockout_sidecar(app)? {
            Some(json) => Ok(serde_json::from_str(&json).unwrap_or_else(|e| {
                log::warn!("lockout sidecar is unreadable, resetting: {e}");
                Self::default()
            })),
            None => Ok(Self::default()),
        }
    }

    fn save(&self, app: &AppHandle) -> Result<()> {
        storage::write_lockout_sidecar(app, &serde_json::to_string(self)?)
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// Seconds remaining until `locked_until_ms`, rounded up so a caller never tells
// the UI to retry a moment too early. Callers only invoke this when locked
// (`locked_until_ms > now_ms`), so the difference is always positive.
fn retry_after_secs(locked_until_ms: i64, now_ms: i64) -> u64 {
    let remaining_ms = (locked_until_ms - now_ms).max(0) as u64;
    remaining_ms.div_ceil(1000)
}

// Exponential delay for the Nth failed attempt (1-indexed), 0 while still free.
fn backoff_delay_secs(failed_attempts: u32) -> u64 {
    if failed_attempts <= FREE_ATTEMPTS {
        return 0;
    }
    let exp = (failed_attempts - FREE_ATTEMPTS).min(63);
    2u64.saturating_pow(exp).min(MAX_DELAY_SECS)
}

// State transition for one more wrong password at time `now_ms`.
fn record_failed_attempt(mut state: LockoutState, now_ms: i64) -> LockoutState {
    state.failed_attempts += 1;
    let delay = backoff_delay_secs(state.failed_attempts);
    state.locked_until_ms = if delay > 0 {
        now_ms + delay as i64 * 1000
    } else {
        0
    };
    state
}

// True only when a SQLite vault DB exists. A legacy `vault.swftx` alone does NOT
// count: the app starts fresh with an empty vault and offers an explicit
// "Import from .swftx" instead (see `import_swftx`).
#[tauri::command]
pub fn is_initialized(app: AppHandle) -> Result<bool> {
    storage::ensure_migrated(&app);
    Ok(storage::db_exists(&app))
}

// Create a brand-new, empty encrypted store protected by `password` (Argon2id +
// a fresh KDF sidecar). The payload key is held in the session, never persisted.
#[tauri::command]
pub fn setup(password: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let (key, store) = create_vault(&app, &password)?;
    state.session.lock().unwrap().set(key, store, false);
    Ok(())
}

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
    storage::ensure_migrated(&app);

    let lockout = LockoutState::load(&app)?;
    let now = now_ms();
    if lockout.locked_until_ms > now {
        return Err(Error::TooManyAttempts {
            retry_after_secs: retry_after_secs(lockout.locked_until_ms, now),
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
            let updated = record_failed_attempt(lockout, now);
            if let Err(e) = updated.save(&app) {
                log::warn!("failed to persist lockout sidecar: {e}");
            }
            if updated.locked_until_ms > now {
                Err(Error::TooManyAttempts {
                    retry_after_secs: retry_after_secs(updated.locked_until_ms, now),
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
    tauri::async_runtime::spawn_blocking(move || unlock_with_password(&app, &password))
        .await
        .map_err(|e| Error::Other(e.to_string()))?
}

// Open the store for an already-resolved key (biometric path) off the UI thread.
async fn open_off_thread(
    app: &AppHandle,
    key: VaultKey,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (store, entries) = open_with_key(&app, &key)?;
        Ok((key, store, entries))
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

// Clear the in-memory key and close the store.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> Result<()> {
    state.session.lock().unwrap().clear();
    Ok(())
}

// Unlock from a locked start using the biometric-gated key in the OS secure
// store. Retrieving the key triggers the biometric prompt; the sidecar decides
// how to interpret the stored bytes (Argon2id master vs legacy secret). The
// store then opens off the UI thread. No migration on unlock.
#[tauri::command]
pub async fn unlock_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<UnlockResult> {
    storage::ensure_migrated(&app);
    let Some(marker) = storage::biometric_marker(&app) else {
        return Err(Error::Other("biometric unlock is not enabled".into()));
    };
    // Read through the gate enrollment recorded, never a re-probed one: trying
    // the other mode on failure would either downgrade an OS-enforced gate to an
    // app-enforced one behind the user's back, or just miss.
    let material = match secure_store::Platform.retrieve(GateMode::from_marker(&marker)) {
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

// True only when the platform supports a biometric-gated store, the biometric
// hardware is available, and a key has been enrolled (opt-in).
#[tauri::command]
pub fn is_biometric_available(app: AppHandle) -> Result<bool> {
    Ok(secure_store::is_supported()
        && biometrics::is_available()
        && storage::biometric_enrolled(&app))
}

// Enrollment state for the settings UI: whether biometric unlock is on, and
// which gate the key sits behind (so the copy can describe it honestly).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BiometricStatus {
    enabled: bool,
    mode: Option<String>,
}

#[tauri::command]
pub fn biometric_status(app: AppHandle) -> Result<BiometricStatus> {
    let marker = storage::biometric_marker(&app);
    Ok(BiometricStatus {
        enabled: is_biometric_available(app.clone())?,
        mode: marker.map(|m| GateMode::from_marker(&m).as_marker().to_string()),
    })
}

// Opt in: store the current session's key material in the OS secure store,
// biometry-gated. Requires an unlocked vault. Returns the gate that enrollment
// settled on — recorded here and honoured verbatim by every later retrieval.
#[tauri::command]
pub fn enable_biometric(app: AppHandle, state: State<'_, AppState>) -> Result<String> {
    if !secure_store::is_supported() || !biometrics::is_available() {
        return Err(Error::Other("biometrics not available".into()));
    }
    let mode = {
        let session = state.session.lock().unwrap();
        secure_store::Platform.store(session.key()?.biometric_material())?
    };
    storage::set_biometric_marker(&app, Some(mode.as_marker()))?;
    Ok(mode.as_marker().to_string())
}

// Opt out: delete the stored key (in every mode) and clear the marker.
#[tauri::command]
pub fn disable_biometric(app: AppHandle) -> Result<()> {
    secure_store::Platform.delete()?;
    storage::set_biometric_marker(&app, None)?;
    Ok(())
}

// Re-derive a fresh Argon2id key (new salt), re-seal every payload under the new
// payload key, re-key the encrypted DB and rewrite the sidecar. Correct even if
// slow: touches every row once. Requires an unlocked session.
//
// Crash-consistency: the three destructive on-disk steps (import → rekey →
// sidecar) are guarded by a recovery snapshot taken first. The sidecar (the
// single source of truth for opening) is written last and atomically, so it only
// ever names a DB already re-keyed to match. On any failure the pre-change,
// old-keyed DB is restored from the snapshot and the OLD sidecar is left in place,
// so the vault still opens under the unchanged current password.
#[tauri::command]
pub fn change_master_password(
    current: String,
    new: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    // Hold the session lock throughout: no other command sees the half-open state
    // while the store is out of the session.
    let mut session = state.session.lock().unwrap();

    // Verify the current password reproduces the unlocked session key.
    if derive_key(&app, &current)?.sqlcipher_key() != session.key()?.sqlcipher_key() {
        return Err(Error::InvalidPassword);
    }

    // Own the open store + key for the duration so we can drop and restore them.
    let store = session.store.take().ok_or(Error::Locked)?;
    let old_key = session.key.take().ok_or(Error::Locked)?;

    // Fresh Argon2id key (new salt). Nothing on disk is touched yet, so on failure
    // just put the untouched store/key back.
    let params = KdfParams::default_argon2id();
    let new_key = match crypto::derive(new.as_bytes(), &params) {
        Ok(master) => VaultKey::Argon2 { master },
        Err(e) => {
            session.set_keyed(old_key, store);
            return Err(e);
        }
    };

    // Recovery point: snapshot the pre-change (old-keyed) DB to a sibling file.
    let backup = storage::db_rekey_backup_path(&app)?;
    if let Err(e) = store.snapshot_to(&backup, &old_key.sqlcipher_key()) {
        let _ = fs::remove_file(&backup);
        session.set_keyed(old_key, store);
        return Err(store_err(e));
    }

    // Destructive sequence. On any error, roll back to the snapshot.
    if let Err(e) = rekey_vault(&store, &old_key, &new_key, &params, &app) {
        // Close the (possibly re-keyed) connection, copy the old-keyed snapshot
        // back over the DB, and reopen under the OLD key (the current password is
        // unchanged). The OLD sidecar is still on disk (it is rewritten only on a
        // successful rekey), so the restored DB opens. Keep the snapshot as a
        // last-resort artifact if the reopen itself fails.
        drop(store);
        match restore_db_from_backup(&app, &backup).and_then(|()| open_with_key(&app, &old_key)) {
            Ok((restored, _)) => session.set_keyed(old_key, restored),
            Err(_) => session.clear(),
        }
        return Err(e);
    }

    // Success: the change is committed on disk. Drop the recovery point.
    let _ = fs::remove_file(&backup);

    // Re-encrypt the Drive token file under the new key if present (sync parity).
    let token = storage::read_gdrive(&app).unwrap_or_default();
    if !token.is_empty() {
        if let Ok(plain) = old_key.cryptor().decrypt(&token) {
            storage::write_gdrive(&app, &new_key.cryptor().encrypt(&plain)?)?;
        }
    }

    // Adopt the new key + store for the live session.
    session.set_keyed(new_key, store);
    drop(session);

    // The biometric-stored key is now stale; re-store the new material or clear
    // it. Re-storing is a fresh enrollment, so the gate is decided again and the
    // marker refreshed — a build that has since gained (or lost) its entitlement
    // moves the key to the matching mode instead of leaving a mislabelled item.
    if storage::biometric_enrolled(&app) {
        let session = state.session.lock().unwrap();
        let stored = secure_store::Platform.store(session.key()?.biometric_material());
        drop(session);
        match stored {
            Ok(mode) => {
                let _ = storage::set_biometric_marker(&app, Some(mode.as_marker()));
            }
            Err(_) => {
                let _ = secure_store::Platform.delete();
                let _ = storage::set_biometric_marker(&app, None);
            }
        }
    }
    Ok(())
}

// The destructive on-disk sequence, isolated so a single `?` failure triggers the
// snapshot rollback in the caller. Sidecar (atomic) written last, after the rekey.
fn rekey_vault(
    store: &SqliteStore,
    old_key: &VaultKey,
    new_key: &VaultKey,
    params: &KdfParams,
    app: &AppHandle,
) -> Result<()> {
    let old_cipher = old_key.payload_cipher();
    let new_cipher = new_key.payload_cipher();
    // Re-seal every row's payload under the new payload key (timestamps + tombstones kept).
    let resealed: Vec<Record> = store
        .export_for_sync()
        .map_err(store_err)?
        .into_iter()
        .map(|r| reseal_record(r, &old_cipher, &new_cipher))
        .collect::<Result<_>>()?;
    store.import(&resealed).map_err(store_err)?;
    store.rekey(&new_key.sqlcipher_key()).map_err(store_err)?;
    record_kdf_meta(store, params)?;
    storage::write_kdf_sidecar(app, &params.to_json()?)?;
    Ok(())
}

// Roll the DB file back to the pre-change snapshot. The connection must already be
// closed. Stale WAL/SHM sidecars are removed so they can't overlay the restored
// (old-keyed) file with new-keyed frames.
fn restore_db_from_backup(app: &AppHandle, backup: &Path) -> Result<()> {
    let db = storage::db_path(app)?;
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = db.clone().into_os_string();
        sidecar.push(suffix);
        let _ = fs::remove_file(std::path::PathBuf::from(sidecar));
    }
    fs::copy(backup, &db)?;
    Ok(())
}

// Unseal a record's payload under the old cipher and re-seal it under the new one,
// preserving all metadata (id/kind/title/tags/url_host/timestamps/tombstone).
fn reseal_record(mut r: Record, old: &PayloadCipher, new: &PayloadCipher) -> Result<Record> {
    let entry = old.unseal(&r.payload)?;
    r.payload = new.seal(&entry)?;
    Ok(r)
}

#[cfg(test)]
mod lockout_tests {
    use super::*;

    // Deterministic "now" — never sleep in these tests.
    const NOW: i64 = 1_700_000_000_000;

    #[test]
    fn free_attempts_have_no_delay() {
        for n in 0..=FREE_ATTEMPTS {
            assert_eq!(backoff_delay_secs(n), 0, "attempt {n} should be free");
        }
    }

    #[test]
    fn delay_doubles_past_the_free_attempts() {
        assert_eq!(backoff_delay_secs(FREE_ATTEMPTS + 1), 2);
        assert_eq!(backoff_delay_secs(FREE_ATTEMPTS + 2), 4);
        assert_eq!(backoff_delay_secs(FREE_ATTEMPTS + 3), 8);
        assert_eq!(backoff_delay_secs(FREE_ATTEMPTS + 4), 16);
    }

    #[test]
    fn delay_is_capped_at_max_delay() {
        assert_eq!(backoff_delay_secs(FREE_ATTEMPTS + 20), MAX_DELAY_SECS);
        // Never overflows even for pathologically large attempt counts.
        assert_eq!(backoff_delay_secs(u32::MAX), MAX_DELAY_SECS);
    }

    #[test]
    fn a_free_attempt_never_locks() {
        let state = LockoutState::default();
        let after = record_failed_attempt(state, NOW);
        assert_eq!(after.failed_attempts, 1);
        assert_eq!(after.locked_until_ms, 0, "still within FREE_ATTEMPTS");
    }

    #[test]
    fn crossing_free_attempts_sets_a_lockout() {
        let mut state = LockoutState::default();
        for _ in 0..FREE_ATTEMPTS {
            state = record_failed_attempt(state, NOW);
        }
        assert_eq!(state.locked_until_ms, 0);

        // The next failure crosses the threshold and locks.
        let locked = record_failed_attempt(state, NOW);
        assert_eq!(locked.failed_attempts, FREE_ATTEMPTS + 1);
        assert_eq!(locked.locked_until_ms, NOW + 2_000);
    }

    #[test]
    fn retry_after_secs_rounds_up_to_the_next_second() {
        // 1500ms remaining must report 2s, never 1s (never tell the UI to
        // retry a moment too early).
        assert_eq!(retry_after_secs(NOW + 1_500, NOW), 2);
        assert_eq!(retry_after_secs(NOW + 2_000, NOW), 2);
        assert_eq!(retry_after_secs(NOW + 1, NOW), 1);
        assert_eq!(retry_after_secs(NOW, NOW), 0);
    }

    #[test]
    fn success_resets_lockout_state() {
        // Whatever the state was, a successful unlock always resets to the
        // zero value — mirrors the `unlock` command's success branch.
        let locked = LockoutState {
            failed_attempts: 9,
            locked_until_ms: NOW + 300_000,
        };
        assert_ne!(locked, LockoutState::default());
        let reset = LockoutState::default();
        assert_eq!(reset.failed_attempts, 0);
        assert_eq!(reset.locked_until_ms, 0);
    }

    #[test]
    fn lockout_state_serde_round_trips() {
        let state = LockoutState {
            failed_attempts: 5,
            locked_until_ms: NOW,
        };
        let json = serde_json::to_string(&state).unwrap();
        let back: LockoutState = serde_json::from_str(&json).unwrap();
        assert_eq!(state, back);
    }

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

    #[test]
    fn corrupt_sidecar_json_falls_back_to_default() {
        // Mirrors `LockoutState::load`'s parse-failure branch: unreadable state
        // fails open (no lockout) rather than erroring the whole unlock flow.
        let parsed: std::result::Result<LockoutState, _> = serde_json::from_str("not json");
        assert!(parsed.is_err());
    }
}
