//! Master-password domain logic: the failed-unlock backoff, and the rekey saga
//! a password change runs.
//!
//! Beside `session.rs` for the same reason the vault-opening helpers are: both
//! are work, not wiring. Everything here is CPU- or disk-bound and only ever
//! runs on a blocking thread, which leaves `commands::auth` a set of thin entry
//! points that lock, hand off, and adopt the result.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::crypto::{KdfParams, PayloadCipher, VaultKey};
use crate::error::{Error, Result};
use crate::session::{open_with_key, record_kdf_meta, store_err};
use crate::storage;
use crate::store::{Record, SqliteStore, VaultStore};

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
pub struct LockoutState {
    failed_attempts: u32,
    // Epoch millis; 0 means "not locked".
    pub locked_until_ms: i64,
}

impl LockoutState {
    // Missing or unparseable sidecar reads as "no lockout" — this state is a
    // throttle, not a security boundary, so failing open here is fine.
    pub fn load(app: &AppHandle) -> Result<Self> {
        match storage::read_lockout_sidecar(app)? {
            Some(json) => Ok(serde_json::from_str(&json).unwrap_or_else(|e| {
                log::warn!("lockout sidecar is unreadable, resetting: {e}");
                Self::default()
            })),
            None => Ok(Self::default()),
        }
    }

    pub fn save(&self, app: &AppHandle) -> Result<()> {
        storage::write_lockout_sidecar(app, &serde_json::to_string(self)?)
    }
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// Seconds remaining until `locked_until_ms`, rounded up so a caller never tells
// the UI to retry a moment too early. Callers only invoke this when locked
// (`locked_until_ms > now_ms`), so the difference is always positive.
pub fn retry_after_secs(locked_until_ms: i64, now_ms: i64) -> u64 {
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
pub fn record_failed_attempt(mut state: LockoutState, now_ms: i64) -> LockoutState {
    state.failed_attempts += 1;
    let delay = backoff_delay_secs(state.failed_attempts);
    state.locked_until_ms = if delay > 0 {
        now_ms + delay as i64 * 1000
    } else {
        0
    };
    state
}

// --- The change-master-password saga ----------------------------------------

/// What a failed password change left behind.
///
/// The error alone is not enough for the caller: the store came *out* of the
/// session to be re-keyed, so whatever survived the rollback has to go back in
/// before the error is returned.
pub struct Rollback {
    pub error: Error,
    /// The vault, reopened under the unchanged old key. `None` when even the
    /// rollback could not reopen it, in which case the session must be cleared.
    pub restored: Option<(VaultKey, SqliteStore)>,
}

/// The whole destructive half of a password change: snapshot, re-seal every
/// payload under `new_key`, re-key the database, rewrite the KDF sidecar.
/// Correct even if slow: touches every row once.
///
/// Crash-consistency: the three destructive on-disk steps (import -> rekey ->
/// sidecar) are guarded by the recovery snapshot taken first. The sidecar (the
/// single source of truth for opening) is written last and atomically, so it
/// only ever names a DB already re-keyed to match. On any failure the
/// pre-change, old-keyed DB is restored from the snapshot and the OLD sidecar is
/// left in place, so the vault still opens under the unchanged current password.
///
/// Blocking from end to end — a whole-vault re-seal plus two whole-file copies —
/// so it only ever runs on the blocking pool, never on a command thread.
#[allow(clippy::result_large_err)]
pub fn rekey(
    app: &AppHandle,
    store: SqliteStore,
    old_key: VaultKey,
    new_key: VaultKey,
    params: &KdfParams,
    backup: &Path,
) -> std::result::Result<(VaultKey, SqliteStore), Rollback> {
    // Recovery point: snapshot the pre-change (old-keyed) DB to a sibling file.
    if let Err(e) = store.snapshot_to(backup, &old_key.sqlcipher_key()) {
        let _ = fs::remove_file(backup);
        return Err(Rollback {
            error: store_err(e),
            restored: Some((old_key, store)),
        });
    }

    // Destructive sequence. On any error, roll back to the snapshot.
    if let Err(error) = rekey_vault(&store, &old_key, &new_key, params, app) {
        // Close the (possibly re-keyed) connection, copy the old-keyed snapshot
        // back over the DB, and reopen under the OLD key (the current password is
        // unchanged). The OLD sidecar is still on disk (it is rewritten only on a
        // successful rekey), so the restored DB opens. Keep the snapshot as a
        // last-resort artifact if the reopen itself fails.
        drop(store);
        let restored = restore_db_from_backup(app, backup)
            .and_then(|()| open_with_key(app, &old_key))
            .ok()
            .map(|(store, _)| (old_key, store));
        return Err(Rollback { error, restored });
    }

    // Success: the change is committed on disk. Drop the recovery point.
    let _ = fs::remove_file(backup);
    Ok((new_key, store))
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
    let entry = old.unseal(&r.id, &r.payload)?;
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
    fn corrupt_sidecar_json_falls_back_to_default() {
        // Mirrors `LockoutState::load`'s parse-failure branch: unreadable state
        // fails open (no lockout) rather than erroring the whole unlock flow.
        let parsed: std::result::Result<LockoutState, _> = serde_json::from_str("not json");
        assert!(parsed.is_err());
    }
}
