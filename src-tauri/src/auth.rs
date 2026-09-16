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
use crate::state::AppState;
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
/// Crash-consistency: the destructive on-disk steps (import -> rekey -> sidecar)
/// are guarded by snapshots of *both* files that decide whether the vault opens —
/// the DB and its KDF sidecar — taken before the first of them. The presence of
/// the DB snapshot is itself the "a change was in flight" marker, so it is the
/// last thing written before the sequence starts and the first thing removed
/// after it commits; [`recover_interrupted_rekey`] rolls the pair back on the
/// next unlock if a crash left it behind. An in-process failure rolls back the
/// same way, so either path leaves the vault open under the unchanged current
/// password.
///
/// The one accepted edge: a crash in the window between the sidecar write and
/// the removal of the snapshots rolls back a change that had actually completed.
/// The OLD password then works and the user repeats the change — a deliberate
/// trade for a single, simple recovery rule ("snapshot present ⇒ roll back")
/// over a commit marker nobody can test.
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
    // Recovery point: snapshot the pre-change (old-keyed) DB to a sibling file,
    // and the sidecar that names its key beside it.
    let snapshot = store
        .snapshot_to(backup, &old_key.sqlcipher_key())
        .map_err(store_err)
        .and_then(|()| snapshot_kdf_sidecar(app));
    if let Err(error) = snapshot {
        let _ = fs::remove_file(backup);
        let _ = remove_kdf_sidecar_backup(app);
        return Err(Rollback {
            error,
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
        // The sidecar itself was never rewritten on this path (that is the last
        // step, and it did not run), so only its snapshot has to go.
        let _ = remove_kdf_sidecar_backup(app);
        return Err(Rollback { error, restored });
    }

    // Success: the change is committed on disk. Drop the recovery point — the DB
    // snapshot first, since its presence alone is what triggers a rollback.
    let _ = fs::remove_file(backup);
    let _ = remove_kdf_sidecar_backup(app);
    Ok((new_key, store))
}

/// Roll back a master-password change a crash left half-applied, before anything
/// tries to open the vault. Called at the top of every unlock path.
///
/// The rule is deliberately blunt: a leftover DB snapshot means [`rekey`] never
/// reached its cleanup, so whatever the DB and sidecar say now is discarded in
/// favour of the pre-change pair — which is the only pair guaranteed to open
/// together. Without it, a crash mid-sequence bricks the vault (a DB re-keyed
/// under params that only ever existed in memory) while a perfectly good
/// snapshot sits beside it.
///
/// One `metadata` call when there is nothing to do, which is every unlock but
/// the vanishingly rare one.
pub fn recover_interrupted_rekey(app: &AppHandle, state: &AppState) -> Result<()> {
    // All four paths are built from ONE workspace lookup, taken under the
    // workspace lock. Resolving them one at a time re-read the active workspace
    // four times, so a `workspace_select` landing between two of them handed
    // back paths from two different vaults — and the rollback below would then
    // copy one workspace's snapshot over another workspace's database.
    //
    // The lock is released before any file work, matching its documented
    // discipline (never held across I/O): all it has to guarantee is that the
    // four paths agree on which vault they belong to.
    let dir = {
        let _paths = state.workspace_lock.lock().unwrap();
        storage::workspace_dir(app)?
    };
    let rolled_back = restore_rekey_backup(
        &dir.join(storage::DB_FILE),
        &dir.join(storage::DB_REKEY_BACKUP_FILE),
        &dir.join(storage::KDF_SIDECAR_FILE),
        &dir.join(storage::KDF_SIDECAR_REKEY_BACKUP_FILE),
    )?;
    if rolled_back {
        log::warn!(
            "rolled back an interrupted master-password change; the previous password applies"
        );
    }
    Ok(())
}

// The file-level half of the recovery, on plain paths so it is testable without
// an `AppHandle`. Reports whether anything was rolled back; the usual answer is
// "no", for the cost of the single `metadata` call below.
fn restore_rekey_backup(
    db: &Path,
    db_backup: &Path,
    sidecar: &Path,
    sidecar_backup: &Path,
) -> Result<bool> {
    if fs::metadata(db_backup).is_err() {
        return Ok(false);
    }
    restore_db_file(db, db_backup)?;
    // Absent only for a vault that had no sidecar to snapshot (legacy/dev); then
    // the DB snapshot is the whole rollback.
    if sidecar_backup.exists() {
        fs::copy(sidecar_backup, sidecar)?;
    }
    // Both go only once the pair is back in place: until then a second crash has
    // to find the marker still there and try again.
    fs::remove_file(db_backup)?;
    let _ = fs::remove_file(sidecar_backup);
    Ok(true)
}

// Copy the KDF sidecar next to the DB snapshot. A vault created before sidecars
// existed has none, and then there is nothing to roll back.
fn snapshot_kdf_sidecar(app: &AppHandle) -> Result<()> {
    let sidecar = storage::kdf_sidecar_path(app)?;
    if !sidecar.exists() {
        return Ok(());
    }
    fs::copy(sidecar, storage::kdf_sidecar_rekey_backup_path(app)?)?;
    Ok(())
}

fn remove_kdf_sidecar_backup(app: &AppHandle) -> Result<()> {
    let _ = fs::remove_file(storage::kdf_sidecar_rekey_backup_path(app)?);
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
// closed.
fn restore_db_from_backup(app: &AppHandle, backup: &Path) -> Result<()> {
    restore_db_file(&storage::db_path(app)?, backup)
}

// Stale WAL/SHM sidecars are removed so they can't overlay the restored
// (old-keyed) file with new-keyed frames.
fn restore_db_file(db: &Path, backup: &Path) -> Result<()> {
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = db.to_path_buf().into_os_string();
        sidecar.push(suffix);
        let _ = fs::remove_file(std::path::PathBuf::from(sidecar));
    }
    fs::copy(backup, db)?;
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
    fn corrupt_sidecar_json_falls_back_to_default() {
        // Mirrors `LockoutState::load`'s parse-failure branch: unreadable state
        // fails open (no lockout) rather than erroring the whole unlock flow.
        let parsed: std::result::Result<LockoutState, _> = serde_json::from_str("not json");
        assert!(parsed.is_err());
    }
}

#[cfg(test)]
mod recovery_tests {
    use super::*;
    use crate::models::Entry;
    use crate::store::migrate;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // The four paths recovery works on, in a fresh dir.
    fn paths() -> (TempDir, PathBuf, PathBuf, PathBuf, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let p = |name: &str| dir.path().join(name);
        let (db, sidecar) = (p(storage::DB_FILE), p(storage::KDF_SIDECAR_FILE));
        let db_backup = p(storage::DB_REKEY_BACKUP_FILE);
        let sidecar_backup = p(storage::KDF_SIDECAR_REKEY_BACKUP_FILE);
        (dir, db, db_backup, sidecar, sidecar_backup)
    }

    #[test]
    fn a_leftover_backup_pair_rolls_both_files_back() {
        let (_dir, db, db_backup, sidecar, sidecar_backup) = paths();
        fs::write(&db, "new-keyed").unwrap();
        fs::write(&db_backup, "old-keyed").unwrap();
        fs::write(&sidecar, "new-params").unwrap();
        fs::write(&sidecar_backup, "old-params").unwrap();
        // WAL/SHM from the interrupted run: new-keyed frames that must not
        // overlay the restored old-keyed file.
        let (wal, shm) = (db.with_extension("db-wal"), db.with_extension("db-shm"));
        fs::write(&wal, "frames").unwrap();
        fs::write(&shm, "index").unwrap();

        assert!(restore_rekey_backup(&db, &db_backup, &sidecar, &sidecar_backup).unwrap());

        assert_eq!(fs::read_to_string(&db).unwrap(), "old-keyed");
        assert_eq!(fs::read_to_string(&sidecar).unwrap(), "old-params");
        assert!(!db_backup.exists() && !sidecar_backup.exists());
        assert!(!wal.exists() && !shm.exists());
    }

    #[test]
    fn a_sidecar_less_vault_rolls_back_the_db_alone() {
        // A legacy/dev vault had no sidecar to snapshot, so there is none to
        // restore — and nothing beside the DB to touch either.
        let (_dir, db, db_backup, sidecar, sidecar_backup) = paths();
        fs::write(&db, "new-keyed").unwrap();
        fs::write(&db_backup, "old-keyed").unwrap();

        assert!(restore_rekey_backup(&db, &db_backup, &sidecar, &sidecar_backup).unwrap());

        assert_eq!(fs::read_to_string(&db).unwrap(), "old-keyed");
        assert!(!sidecar.exists());
        assert!(!db_backup.exists());
    }

    #[test]
    fn no_backup_is_a_no_op() {
        // The hot path: every unlock that did not follow a crashed change.
        let (_dir, db, db_backup, sidecar, sidecar_backup) = paths();
        fs::write(&db, "live").unwrap();
        fs::write(&sidecar, "params").unwrap();

        assert!(!restore_rekey_backup(&db, &db_backup, &sidecar, &sidecar_backup).unwrap());

        assert_eq!(fs::read_to_string(&db).unwrap(), "live");
        assert_eq!(fs::read_to_string(&sidecar).unwrap(), "params");
    }

    #[test]
    fn a_crash_before_the_sidecar_write_leaves_the_old_password_working() {
        // The bricking window, end to end on a real store: payloads re-sealed
        // and the DB re-keyed, but the new params never reached disk, so they
        // died with the process. Recovery has to undo all of it.
        let (_dir, db, db_backup, sidecar, sidecar_backup) = paths();
        fs::write(&sidecar, "old-params").unwrap();
        let old = VaultKey::legacy_from_password("old-pw");
        let new = VaultKey::legacy_from_password("new-pw");
        let entry = Entry {
            id: "1".into(),
            title: "before".into(),
            ..Default::default()
        };

        {
            let store = SqliteStore::open(&db, &old.sqlcipher_key()).unwrap();
            let payload = old.payload_cipher().seal(&entry).unwrap();
            store
                .upsert(&migrate::build_record(&entry, payload).unwrap())
                .unwrap();
            // The saga: snapshot the pair, re-seal every payload, re-key — then
            // "crash" instead of writing the sidecar.
            store.snapshot_to(&db_backup, &old.sqlcipher_key()).unwrap();
            fs::copy(&sidecar, &sidecar_backup).unwrap();
            let resealed: Vec<Record> = store
                .export_for_sync()
                .unwrap()
                .into_iter()
                .map(|r| reseal_record(r, &old.payload_cipher(), &new.payload_cipher()).unwrap())
                .collect();
            store.import(&resealed).unwrap();
            store.rekey(&new.sqlcipher_key()).unwrap();
        }

        assert!(restore_rekey_backup(&db, &db_backup, &sidecar, &sidecar_backup).unwrap());

        let store = SqliteStore::open(&db, &old.sqlcipher_key()).unwrap();
        let record = store.get("1").unwrap().unwrap();
        let revealed = old.payload_cipher().unseal(&record.payload).unwrap();
        assert_eq!(revealed.title, "before");
        assert_eq!(fs::read_to_string(&sidecar).unwrap(), "old-params");
    }
}
