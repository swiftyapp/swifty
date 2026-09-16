//! Master-password domain logic: the failed-unlock backoff, and the rekey saga
//! a password change runs.
//!
//! Beside `session.rs` for the same reason the vault-opening helpers are: both
//! are work, not wiring. Everything here is CPU- or disk-bound and only ever
//! runs on a blocking thread, which leaves `commands::auth` a set of thin entry
//! points that lock, hand off, and adopt the result.

use std::fs;
use std::path::{Path, PathBuf};
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

/// The files a password change touches and the snapshots that guard them, all
/// in one workspace directory.
///
/// Resolved once, up front, from a single workspace lookup: resolving each path
/// on demand re-reads the active workspace every time, and a switch landing
/// between two lookups would pair one vault's snapshot with another's database.
/// On plain paths (no `AppHandle`) so the saga and its recovery are testable.
pub struct RekeyPaths {
    pub db: PathBuf,
    /// The DB snapshot, whose presence is the "a change was in flight" marker.
    pub db_backup: PathBuf,
    /// Where the DB snapshot is built before it is published as `db_backup`.
    staging: PathBuf,
    pub sidecar: PathBuf,
    pub sidecar_backup: PathBuf,
}

impl RekeyPaths {
    pub fn in_dir(dir: &Path) -> Self {
        let db_backup = dir.join(storage::DB_REKEY_BACKUP_FILE);
        let mut staging = db_backup.clone().into_os_string();
        staging.push(".tmp");
        Self {
            db: dir.join(storage::DB_FILE),
            db_backup,
            staging: PathBuf::from(staging),
            sidecar: dir.join(storage::KDF_SIDECAR_FILE),
            sidecar_backup: dir.join(storage::KDF_SIDECAR_REKEY_BACKUP_FILE),
        }
    }

    /// The active workspace's paths. The lookup happens under the workspace
    /// lock so all five agree on which vault they belong to; the lock is
    /// released before any file work, per its documented discipline.
    pub fn resolve(app: &AppHandle, state: &AppState) -> Result<Self> {
        let dir = {
            let _paths = state.workspace_lock.lock().unwrap();
            storage::workspace_dir(app)?
        };
        Ok(Self::in_dir(&dir))
    }
}

/// The whole destructive half of a password change: snapshot, re-seal every
/// payload under `new_key`, re-key the database, rewrite the KDF sidecar.
/// Correct even if slow: touches every row once.
///
/// Crash-consistency: the destructive on-disk steps (import -> rekey -> sidecar)
/// are guarded by snapshots of *both* files that decide whether the vault opens —
/// the DB and its KDF sidecar — taken before the first of them. The presence of
/// the DB snapshot is itself the "a change was in flight" marker, so it is
/// published (renamed into place from a staging file, after the sidecar snapshot
/// is complete) as the last step before the sequence starts and removed as the
/// first step after it commits; [`recover_interrupted_rekey`] rolls the pair
/// back on the next unlock if a crash left it behind. An in-process failure
/// rolls back the same way, so either path leaves the vault open under the
/// unchanged current password.
///
/// The one accepted edge: a crash in the window between the sidecar write and
/// the removal of the snapshots rolls back a change that had actually completed.
/// The OLD password then works and the user repeats the change — a deliberate
/// trade for a single, simple recovery rule ("snapshot present ⇒ roll back")
/// over a commit marker nobody can test. A marker that cannot be removed after
/// a commit falls into the same edge on purpose (see [`discard_snapshot`]).
///
/// Blocking from end to end — a whole-vault re-seal plus two whole-file copies —
/// so it only ever runs on the blocking pool, never on a command thread. The
/// caller holds the setup step for the duration, and every unlock path takes
/// the same step, so recovery can never run against a change still in flight.
#[allow(clippy::result_large_err)]
pub fn rekey(
    app: &AppHandle,
    store: SqliteStore,
    old_key: VaultKey,
    new_key: VaultKey,
    params: &KdfParams,
    paths: &RekeyPaths,
) -> std::result::Result<(VaultKey, SqliteStore), Rollback> {
    // Recovery point: snapshot the pre-change (old-keyed) DB and the sidecar
    // that names its key, and publish the pair.
    if let Err(error) = publish_snapshot(&store, &old_key, paths) {
        // Nothing destructive has run. Whatever the failed snapshot left behind
        // must not read as a recovery point on the next unlock.
        let _ = fs::remove_file(&paths.staging);
        discard_snapshot(paths);
        return Err(Rollback {
            error,
            restored: Some((old_key, store)),
        });
    }

    // Destructive sequence. On any error, roll back to the snapshot.
    if let Err(error) = rekey_vault(&store, &old_key, &new_key, params, &paths.sidecar) {
        // Close the (possibly re-keyed) connection, copy the old-keyed snapshot
        // back over the DB, and reopen under the OLD key (the current password is
        // unchanged). The OLD sidecar is still on disk (it is rewritten only on a
        // successful rekey), so the restored DB opens.
        drop(store);
        let restored = restore_db_file(&paths.db, &paths.db_backup)
            .and_then(|()| open_with_key(app, &old_key))
            .ok()
            .map(|(store, _)| (old_key, store));
        // The vault is back on the pre-change pair and about to be adopted as a
        // live, writable session, so the marker has to go with it: left behind,
        // the next unlock would roll back to this snapshot again and discard
        // every edit made since. Kept only when even the rollback failed, as a
        // last-resort artifact for the recovery on the next unlock.
        if restored.is_some() {
            discard_snapshot(paths);
        }
        return Err(Rollback { error, restored });
    }

    // Success: the change is committed on disk. Drop the recovery point.
    discard_snapshot(paths);
    Ok((new_key, store))
}

// Build the recovery point and publish it in the one order a crash cannot
// misrepresent: the DB snapshot goes to a staging name and the sidecar snapshot
// is written whole (atomically), and only then is the DB snapshot renamed into
// place as the marker. Recovery keys off the marker alone, so a crash anywhere
// before the rename leaves at most a staging file it never looks at — never a
// half-copied "snapshot" it would copy over a healthy vault.
fn publish_snapshot(store: &SqliteStore, old_key: &VaultKey, paths: &RekeyPaths) -> Result<()> {
    let _ = fs::remove_file(&paths.staging);
    store
        .snapshot_to(&paths.staging, &old_key.sqlcipher_key())
        .map_err(store_err)?;
    // Durable before the rename, so the marker never points at bytes that a
    // power loss could still take back.
    fs::File::open(&paths.staging)?.sync_all()?;
    // A vault created before sidecars existed has none; recovery reads the
    // absence of this snapshot as "restore to no sidecar".
    match fs::read_to_string(&paths.sidecar) {
        Ok(json) => storage::atomic_write_file(&paths.sidecar_backup, &json)?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let _ = fs::remove_file(&paths.sidecar_backup);
        }
        Err(e) => return Err(e.into()),
    }
    fs::rename(&paths.staging, &paths.db_backup)?;
    Ok(())
}

// Retire the recovery point, marker first. The sidecar snapshot goes only once
// the marker is gone: recovery reads "marker without sidecar snapshot" as a
// vault that had no sidecar, and removing the sidecar snapshot from under a
// marker that stubbornly stays (a sharing violation on Windows, say) would turn
// that reading into a rollback that pairs the old DB with the new sidecar. With
// the pair left intact, the worst case is the accepted edge: the next unlock
// rolls a completed change back and the previous password applies.
fn discard_snapshot(paths: &RekeyPaths) {
    match fs::remove_file(&paths.db_backup) {
        Ok(()) => {
            let _ = fs::remove_file(&paths.sidecar_backup);
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let _ = fs::remove_file(&paths.sidecar_backup);
        }
        Err(e) => log::warn!(
            "could not remove the rekey snapshot; the next unlock will roll the change back: {e}"
        ),
    }
}

/// Roll back a master-password change a crash left half-applied, before anything
/// tries to open the vault. Called at the top of every unlock path, under the
/// same setup step a password change holds — so it never mistakes a change
/// still in flight (whose store is still open) for an interrupted one.
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
    if restore_rekey_backup(&RekeyPaths::resolve(app, state)?)? {
        log::warn!(
            "rolled back an interrupted master-password change; the previous password applies"
        );
    }
    Ok(())
}

// The file-level half of the recovery. Reports whether anything was rolled
// back; the usual answer is "no", for the cost of the single `metadata` call
// below. A staging file without a marker (a crash mid-snapshot) is not a
// recovery point and is left alone; the next password change replaces it.
fn restore_rekey_backup(paths: &RekeyPaths) -> Result<bool> {
    if fs::metadata(&paths.db_backup).is_err() {
        return Ok(false);
    }
    restore_db_file(&paths.db, &paths.db_backup)?;
    // The marker is only ever published after the sidecar snapshot is complete
    // (see `publish_snapshot`), so its absence here has exactly one meaning: the
    // vault had no sidecar when the change began (legacy/dev), and the one the
    // interrupted change may have written names a key the restored DB does not
    // use. Restoring "no sidecar" is as much a part of the rollback as
    // restoring the old one.
    if paths.sidecar_backup.exists() {
        fs::copy(&paths.sidecar_backup, &paths.sidecar)?;
    } else {
        let _ = fs::remove_file(&paths.sidecar);
    }
    // Both go only once the pair is back in place: until then a second crash has
    // to find the marker still there and try again.
    fs::remove_file(&paths.db_backup)?;
    let _ = fs::remove_file(&paths.sidecar_backup);
    let _ = fs::remove_file(&paths.staging);
    Ok(true)
}

// The destructive on-disk sequence, isolated so a single `?` failure triggers the
// snapshot rollback in the caller. Sidecar (atomic) written last, after the rekey.
fn rekey_vault(
    store: &SqliteStore,
    old_key: &VaultKey,
    new_key: &VaultKey,
    params: &KdfParams,
    sidecar: &Path,
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
    storage::atomic_write_file(sidecar, &params.to_json()?)?;
    Ok(())
}

// Roll the DB file back to the pre-change snapshot. The connection must already
// be closed. Stale WAL/SHM sidecars are removed so they can't overlay the
// restored (old-keyed) file with new-keyed frames.
fn restore_db_file(db: &Path, backup: &Path) -> Result<()> {
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = db.to_path_buf().into_os_string();
        sidecar.push(suffix);
        let _ = fs::remove_file(PathBuf::from(sidecar));
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
    use tempfile::TempDir;

    // The paths recovery works on, in a fresh dir.
    fn paths() -> (TempDir, RekeyPaths) {
        let dir = tempfile::tempdir().unwrap();
        let paths = RekeyPaths::in_dir(dir.path());
        (dir, paths)
    }

    // A real (legacy-keyed, so no Argon2id cost) store holding one entry.
    fn store_with_one_entry(db: &Path, key: &VaultKey) -> SqliteStore {
        let entry = Entry {
            id: "1".into(),
            title: "before".into(),
            ..Default::default()
        };
        let store = SqliteStore::open(db, &key.sqlcipher_key()).unwrap();
        let payload = key.payload_cipher().seal(&entry).unwrap();
        store
            .upsert(&migrate::build_record(&entry, payload).unwrap())
            .unwrap();
        store
    }

    fn title_under(db: &Path, key: &VaultKey) -> String {
        let store = SqliteStore::open(db, &key.sqlcipher_key()).unwrap();
        let record = store.get("1").unwrap().unwrap();
        key.payload_cipher().unseal(&record.payload).unwrap().title
    }

    #[test]
    fn a_leftover_backup_pair_rolls_both_files_back() {
        let (_dir, p) = paths();
        fs::write(&p.db, "new-keyed").unwrap();
        fs::write(&p.db_backup, "old-keyed").unwrap();
        fs::write(&p.sidecar, "new-params").unwrap();
        fs::write(&p.sidecar_backup, "old-params").unwrap();
        // WAL/SHM from the interrupted run: new-keyed frames that must not
        // overlay the restored old-keyed file.
        let (wal, shm) = (p.db.with_extension("db-wal"), p.db.with_extension("db-shm"));
        fs::write(&wal, "frames").unwrap();
        fs::write(&shm, "index").unwrap();

        assert!(restore_rekey_backup(&p).unwrap());

        assert_eq!(fs::read_to_string(&p.db).unwrap(), "old-keyed");
        assert_eq!(fs::read_to_string(&p.sidecar).unwrap(), "old-params");
        assert!(!p.db_backup.exists() && !p.sidecar_backup.exists());
        assert!(!wal.exists() && !shm.exists());
    }

    #[test]
    fn a_sidecar_less_vault_rolls_back_to_no_sidecar() {
        // A legacy/dev vault had no sidecar to snapshot. The interrupted change
        // got as far as writing one, which names an Argon2id key the restored
        // (legacy-keyed) DB does not use — left in place, neither password
        // would open the vault.
        let (_dir, p) = paths();
        fs::write(&p.db, "new-keyed").unwrap();
        fs::write(&p.db_backup, "old-keyed").unwrap();
        fs::write(&p.sidecar, "new-params").unwrap();

        assert!(restore_rekey_backup(&p).unwrap());

        assert_eq!(fs::read_to_string(&p.db).unwrap(), "old-keyed");
        assert!(
            !p.sidecar.exists(),
            "the new sidecar must go with the new DB"
        );
        assert!(!p.db_backup.exists());
    }

    #[test]
    fn no_backup_is_a_no_op() {
        // The hot path: every unlock that did not follow a crashed change.
        let (_dir, p) = paths();
        fs::write(&p.db, "live").unwrap();
        fs::write(&p.sidecar, "params").unwrap();

        assert!(!restore_rekey_backup(&p).unwrap());

        assert_eq!(fs::read_to_string(&p.db).unwrap(), "live");
        assert_eq!(fs::read_to_string(&p.sidecar).unwrap(), "params");
    }

    #[test]
    fn a_crash_mid_snapshot_is_not_a_recovery_point() {
        // The process died while the DB snapshot was being built: a partial
        // staging file, no marker. The vault is untouched and healthy, and the
        // half-copied bytes must never be copied over it.
        let (_dir, p) = paths();
        fs::write(&p.db, "live").unwrap();
        fs::write(&p.sidecar, "params").unwrap();
        fs::write(&p.staging, "half a data").unwrap();
        // ...and the sidecar snapshot may or may not have landed by then.
        fs::write(&p.sidecar_backup, "params").unwrap();

        assert!(!restore_rekey_backup(&p).unwrap());

        assert_eq!(fs::read_to_string(&p.db).unwrap(), "live");
        assert_eq!(fs::read_to_string(&p.sidecar).unwrap(), "params");
    }

    #[test]
    fn a_published_snapshot_is_a_complete_pair_with_nothing_staged() {
        let (_dir, p) = paths();
        fs::write(&p.sidecar, "old-params").unwrap();
        let old = VaultKey::legacy_from_password("old-pw");
        let store = store_with_one_entry(&p.db, &old);

        publish_snapshot(&store, &old, &p).unwrap();

        assert!(!p.staging.exists(), "the staging file outlived the publish");
        assert_eq!(fs::read_to_string(&p.sidecar_backup).unwrap(), "old-params");
        assert_eq!(title_under(&p.db_backup, &old), "before");

        // A stale sidecar snapshot from an earlier change never survives into a
        // pair whose vault has no sidecar: recovery would restore it.
        fs::remove_file(&p.sidecar).unwrap();
        publish_snapshot(&store, &old, &p).unwrap();
        assert!(!p.sidecar_backup.exists());
        assert!(p.db_backup.exists());
    }

    #[test]
    fn discarding_the_snapshot_retires_the_whole_pair() {
        let (_dir, p) = paths();
        fs::write(&p.db_backup, "old-keyed").unwrap();
        fs::write(&p.sidecar_backup, "old-params").unwrap();

        discard_snapshot(&p);

        assert!(!p.db_backup.exists() && !p.sidecar_backup.exists());
        // Idempotent: nothing to retire is not a failure.
        discard_snapshot(&p);
    }

    #[test]
    fn a_crash_before_the_sidecar_write_leaves_the_old_password_working() {
        // The bricking window, end to end on a real store: payloads re-sealed
        // and the DB re-keyed, but the new params never reached disk, so they
        // died with the process. Recovery has to undo all of it.
        let (_dir, p) = paths();
        fs::write(&p.sidecar, "old-params").unwrap();
        let old = VaultKey::legacy_from_password("old-pw");
        let new = VaultKey::legacy_from_password("new-pw");

        {
            let store = store_with_one_entry(&p.db, &old);
            // The saga: snapshot the pair, re-seal every payload, re-key — then
            // "crash" instead of writing the sidecar.
            publish_snapshot(&store, &old, &p).unwrap();
            let resealed: Vec<Record> = store
                .export_for_sync()
                .unwrap()
                .into_iter()
                .map(|r| reseal_record(r, &old.payload_cipher(), &new.payload_cipher()).unwrap())
                .collect();
            store.import(&resealed).unwrap();
            store.rekey(&new.sqlcipher_key()).unwrap();
        }

        assert!(restore_rekey_backup(&p).unwrap());

        assert_eq!(title_under(&p.db, &old), "before");
        assert_eq!(fs::read_to_string(&p.sidecar).unwrap(), "old-params");
    }

    #[test]
    fn a_failed_change_that_rolled_back_in_process_leaves_no_marker() {
        // The in-process rollback reopens the old-keyed vault and hands it back
        // as a live session. If the marker stayed, the next unlock would roll
        // back to this snapshot again and discard every edit made meanwhile.
        let (_dir, p) = paths();
        fs::write(&p.sidecar, "old-params").unwrap();
        let old = VaultKey::legacy_from_password("old-pw");
        let store = store_with_one_entry(&p.db, &old);
        publish_snapshot(&store, &old, &p).unwrap();
        drop(store);

        // What `rekey`'s error branch does once the restore and reopen succeed.
        restore_db_file(&p.db, &p.db_backup).unwrap();
        discard_snapshot(&p);

        assert!(!p.db_backup.exists() && !p.sidecar_backup.exists());
        assert!(!restore_rekey_backup(&p).unwrap());
        assert_eq!(title_under(&p.db, &old), "before");
    }
}
