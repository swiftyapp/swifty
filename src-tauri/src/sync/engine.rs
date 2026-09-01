//! The sync engine: pull, merge, decide, push.
//!
//! Two traits keep the algorithm away from both Google and Tauri — [`Remote`]
//! is the one file on the drive, [`LocalVault`] is this device's store — so the
//! whole of [`sync`] is exercised in-process against a fake drive and real
//! SQLCipher vaults in temp dirs.
//!
//! # Why this converges
//!
//! Every push is the *whole* state, and [`SqliteStore::merge_records`] is a join
//! (idempotent, commutative, associative). So a device that loses a race has not
//! lost data: its digest still differs from the remote, and its next sync pulls
//! the winner, merges, and pushes the union. Divergence is temporary by
//! construction; the only permanent state two synced devices can reach is the
//! same one.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{AppHandle, Manager};
use zeroize::Zeroizing;

use super::pack::{self, PackError};
use crate::commands::store_err;
use crate::error::{Error, Result};
use crate::state::AppState;
use crate::storage;
use crate::store::{state_digest, Record, SqliteStore, StoreError, VaultStore};

/// How long a tombstone is kept before it is reclaimed. A device offline for
/// longer than this can resurrect what it deleted; see
/// [`SqliteStore::purge_tombstones_before`] for the trade.
const TOMBSTONE_TTL_MS: i64 = 90 * 24 * 60 * 60 * 1000;

/// How many times a run will re-pull after losing a race before giving up. A
/// bound rather than a retry loop: if the remote revision keeps moving, another
/// device is syncing in a tight loop and the right answer is to stop and let the
/// next scheduled run settle it, not to spin.
const MAX_ATTEMPTS: usize = 3;

// Both under `SYNC_META_PREFIX`, so a restore onto a fresh install scrubs them
// (the source device's bookkeeping means nothing on the target).
const META_REMOTE_REV: &str = "sync_remote_rev";
const META_LAST_MS: &str = "sync_last_ms";

// Surfaced verbatim by the sync indicator, so it has to read as a sentence.
const FOREIGN_VAULT: &str = "Google Drive holds a vault from a different Swifty install";

/// The remote snapshot together with the revision it was read at.
pub struct RemoteFile {
    pub bytes: Vec<u8>,
    /// Empty when the backend exposes no revision id; the pre-flight check then
    /// degrades to "always looks unchanged", which costs race detection but
    /// never correctness (the loser re-converges on its next run).
    pub revision: String,
}

/// The single remote artifact this engine syncs against.
pub trait Remote {
    /// The current contents, or `None` when nothing has ever been pushed.
    fn fetch(&self) -> Result<Option<RemoteFile>>;
    /// The current revision id without downloading the body.
    fn head_revision(&self) -> Result<Option<String>>;
    /// Replace the contents, returning the resulting revision id.
    fn upload(&self, bytes: &[u8]) -> Result<String>;
}

/// This device's vault, as the engine needs it.
///
/// Every method is a complete unit of work rather than a borrow of the store,
/// so the production implementation can take and release the session lock
/// around each one. A network round trip must never be made while holding it —
/// that is precisely what made the first sync implementation freeze the UI.
///
/// A run is therefore *not* one transaction: the user can save an entry between
/// the merge and the pack. That is safe, and deliberately so. A write that
/// lands mid-run only ever makes the local state newer, so the snapshot pushed
/// is a superset of the one the digest was taken from — never a rollback — and
/// the write's own debounced sync settles whatever is left over.
pub trait LocalVault {
    /// Open a pulled `.swsync` pack and read its records out. The local
    /// database is not touched: the snapshot goes into its own scratch DB.
    fn decode(&self, pack_bytes: &[u8]) -> Result<Vec<Record>>;
    /// Last-writer-wins merge of `incoming`; returns the rows written.
    fn merge(&self, incoming: &[Record]) -> Result<usize>;
    /// Fingerprint of the whole entry table, tombstones included.
    fn digest(&self) -> Result<[u8; 32]>;
    /// Reclaim tombstones older than `cutoff_ms`, then pack the vault for upload.
    fn pack(&self, cutoff_ms: i64) -> Result<Vec<u8>>;
    /// Record a completed push: the revision it landed at, and when.
    fn note_push(&self, revision: &str, at_ms: i64) -> Result<()>;
}

/// What one run did, for the caller's events and logs.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct SyncOutcome {
    /// Rows the merge wrote locally. Non-zero means the entry list changed and
    /// the frontend has to be told.
    pub merged: usize,
    /// Whether a new snapshot was uploaded.
    pub pushed: bool,
}

/// Run one sync: pull, merge, and push if — and only if — the two digests differ.
pub fn sync<R: Remote, L: LocalVault>(remote: &R, local: &L, now_ms: i64) -> Result<SyncOutcome> {
    let mut outcome = SyncOutcome::default();

    for _ in 0..MAX_ATTEMPTS {
        // 1-3. Pull, open the snapshot, merge it in. A remote that cannot be
        // read errors out here, before the local vault has been touched.
        let pulled = remote.fetch()?;
        let base_revision = match &pulled {
            Some(file) => {
                let remote_records = local.decode(&file.bytes)?;
                outcome.merged += local.merge(&remote_records)?;

                // 4. The push decision is digest inequality, nothing else.
                //
                // Not the dirty flag, and not "the merge changed something":
                // both miss the case where local is a strict superset of remote
                // — another device pushed a state derived from an older pull
                // and clobbered ours. Merging that back in adds nothing to us
                // (every incoming row loses last-writer-wins), so a
                // change-driven heuristic concludes "in sync" and leaves our
                // entries missing from the remote forever. The digests still
                // differ, so this pushes.
                if local.digest()? == state_digest(&remote_records) {
                    return Ok(outcome);
                }
                Some(file.revision.clone())
            }
            // Nothing on the remote yet: this run creates it.
            None => None,
        };

        // 5. Pre-flight. If the head moved since the pull, another device
        // pushed while we were merging and our snapshot would drop its work.
        // Start over from its state instead.
        if remote.head_revision()? != base_revision {
            continue;
        }

        // Purge *before* packing, not after. The artifact we upload then
        // already excludes the reclaimed tombstones, so the digest we push is
        // the digest we hold; purging afterwards would re-dirty local state the
        // instant the push completed and earn a second, pointless push. It is
        // also safe by age alone: a tombstone this old was pushed many syncs
        // ago, so the "never purge before it has been pushed once" rule holds
        // without any extra bookkeeping.
        let bytes = local.pack(now_ms - TOMBSTONE_TTL_MS)?;
        let revision = remote.upload(&bytes)?;
        local.note_push(&revision, now_ms)?;
        outcome.pushed = true;
        return Ok(outcome);
    }

    Err(Error::Other(
        "another device kept changing the remote vault; sync will retry later".into(),
    ))
}

// --- the local side, backed by the unlocked session -------------------------

/// [`LocalVault`] over the session's open store.
///
/// The key is copied once at the start of the run: it is what opens the pulled
/// snapshot, and that step deliberately touches no session state at all. The
/// *store* is not copied — it is borrowed from the session for each operation
/// — so a run that outlives its session fails with [`Error::Locked`] on its
/// next step and stops. Stopping there leaves nothing partial behind: the merge
/// and the pack are each a single transaction, and re-running a push is a
/// no-op once the digests agree.
pub struct SessionVault {
    app: AppHandle,
    key: Zeroizing<Vec<u8>>,
    kdf_params_json: String,
    scratch: PathBuf,
}

impl SessionVault {
    /// Capture what a run needs from the live session. Fails if the vault is
    /// locked, or has no KDF descriptor to put in the pack header — without one
    /// a fresh install could never derive the key to open what we upload.
    pub fn capture(app: &AppHandle) -> Result<Self> {
        let kdf_params_json = storage::read_kdf_sidecar(app)?.ok_or_else(|| {
            Error::Other("this vault predates the key descriptor and cannot be synced".into())
        })?;
        let state = app.state::<AppState>();
        let session = state.session.lock().unwrap();
        Ok(Self {
            app: app.clone(),
            key: Zeroizing::new(session.key()?.sqlcipher_key().to_vec()),
            kdf_params_json,
            scratch: storage::sync_scratch_dir(app)?,
        })
    }

    // Borrow the session's store for one operation. The captured key is checked
    // against the live one first: a change-master-password that landed mid-run
    // re-keyed the database, and packing it under the old key would produce a
    // snapshot nobody can open.
    fn with_store<T>(&self, f: impl FnOnce(&SqliteStore) -> Result<T>) -> Result<T> {
        let state = self.app.state::<AppState>();
        let session = state.session.lock().unwrap();
        if *self.key != session.key()?.sqlcipher_key() {
            return Err(Error::Other("the vault key changed during sync".into()));
        }
        f(session.store()?)
    }
}

impl LocalVault for SessionVault {
    fn decode(&self, pack_bytes: &[u8]) -> Result<Vec<Record>> {
        decode_pack(pack_bytes, &self.kdf_params_json, &self.key, &self.scratch)
    }

    fn merge(&self, incoming: &[Record]) -> Result<usize> {
        self.with_store(|store| store.merge_records(incoming).map_err(store_err))
    }

    fn digest(&self) -> Result<[u8; 32]> {
        self.with_store(|store| store.state_digest().map_err(store_err))
    }

    fn pack(&self, cutoff_ms: i64) -> Result<Vec<u8>> {
        self.with_store(|store| {
            purge_and_pack(
                store,
                &self.key,
                &self.kdf_params_json,
                &self.scratch,
                cutoff_ms,
            )
        })
    }

    fn note_push(&self, revision: &str, at_ms: i64) -> Result<()> {
        self.with_store(|store| note_push(store, revision, at_ms))
    }
}

// --- shared implementations -------------------------------------------------

/// Read a pulled pack, refusing one this vault could not have written.
///
/// The descriptor check is not redundant with the open below. A pack from a
/// *different* vault — a second install that ran setup instead of restoring —
/// is sealed under a key this device cannot derive, and SQLCipher reports that
/// exactly the way it reports corruption. Distinguishing them here is what
/// stops the app telling someone their remote vault is damaged when it is
/// merely someone else's.
fn decode_pack(
    bytes: &[u8],
    expected_kdf_params_json: &str,
    key: &[u8],
    scratch_dir: &Path,
) -> Result<Vec<Record>> {
    let unpacked = pack::unpack(bytes).map_err(remote_pack_error)?;
    if unpacked.kdf_params_json != expected_kdf_params_json {
        return Err(Error::Other(FOREIGN_VAULT.into()));
    }
    records_from_snapshot(&unpacked.snapshot, key, scratch_dir)
}

/// Open a pulled snapshot in a throwaway database and export its records.
///
/// The snapshot must land on disk before SQLCipher can read it, so it goes to a
/// uniquely named scratch file that a guard removes on every exit path. The
/// local vault is never opened, written, or replaced here: a hostile or broken
/// remote can only ever fail this function.
fn records_from_snapshot(snapshot: &[u8], key: &[u8], scratch_dir: &Path) -> Result<Vec<Record>> {
    fs::create_dir_all(scratch_dir)?;
    let scratch = Scratch(scratch_dir.join(scratch_name("remote")));
    fs::write(&scratch.0, snapshot)?;

    let store = SqliteStore::open(&scratch.0, key).map_err(|e| match e {
        // A schema this build has never seen is "update the app", never
        // "your remote vault is damaged" and never "wrong password".
        StoreError::SchemaNewer => Error::VaultTooNew,
        _ => Error::Other("Remote vault file is invalid".into()),
    })?;
    store.export_for_sync().map_err(store_err)
}

// A pack this build cannot parse is corruption, except for a format stamped by
// a newer build — same distinction the store draws for its schema.
fn remote_pack_error(e: PackError) -> Error {
    match e {
        PackError::UnknownVersion(_) => Error::VaultTooNew,
        PackError::Io(e) => Error::Io(e),
        _ => Error::Other("Remote vault file is invalid".into()),
    }
}

fn purge_and_pack(
    store: &SqliteStore,
    key: &[u8],
    kdf_params_json: &str,
    scratch_dir: &Path,
    cutoff_ms: i64,
) -> Result<Vec<u8>> {
    store
        .purge_tombstones_before(cutoff_ms)
        .map_err(store_err)?;
    Ok(pack::pack_store(store, key, kdf_params_json, scratch_dir)?)
}

fn note_push(store: &SqliteStore, revision: &str, at_ms: i64) -> Result<()> {
    store
        .meta_set(META_REMOTE_REV, revision)
        .map_err(store_err)?;
    store
        .meta_set(META_LAST_MS, &at_ms.to_string())
        .map_err(store_err)
}

// Unique per call: a scheduled run and a manual one must not share a path.
fn scratch_name(role: &str) -> String {
    static N: AtomicU64 = AtomicU64::new(0);
    format!(
        "swsync-{role}-{}-{}.db",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    )
}

// Removes the scratch database and its WAL/SHM siblings however we return.
struct Scratch(PathBuf);

impl Drop for Scratch {
    fn drop(&mut self) {
        storage::remove_db_files(&self.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::KdfParams;
    use std::sync::Mutex;

    const KEY: &[u8] = &[0x5a; 32];
    const NOW: i64 = 1_700_000_000_000;
    const DAY_MS: i64 = 24 * 60 * 60 * 1000;

    fn kdf_json() -> String {
        KdfParams::argon2id(b"salt-0123456789012345", 256, 1, 1)
            .to_json()
            .unwrap()
    }

    fn tmp_dir() -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "swifty-engine-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn record(id: &str, updated_at: i64, payload: &[u8]) -> Record {
        Record {
            id: id.into(),
            kind: "login".into(),
            title: format!("Entry {id}"),
            tags: "[]".into(),
            url_host: "example.com".into(),
            created_at: 100,
            updated_at,
            deleted_at: None,
            payload: payload.to_vec(),
            card_brand: None,
        }
    }

    fn tombstone(id: &str, deleted_at: i64) -> Record {
        Record {
            deleted_at: Some(deleted_at),
            updated_at: deleted_at,
            ..record(id, deleted_at, b"")
        }
    }

    // A device: its own vault directory, store, and scratch space.
    struct Device {
        store: SqliteStore,
        scratch: PathBuf,
    }

    impl Device {
        fn new() -> Self {
            let dir = tmp_dir();
            Self {
                store: SqliteStore::open(&dir.join("vault.db"), KEY).unwrap(),
                scratch: dir.join("scratch"),
            }
        }

        fn seeded(recs: &[Record]) -> Self {
            let device = Self::new();
            device.store.import(recs).unwrap();
            device
        }

        fn ids(&self) -> Vec<String> {
            self.store
                .list()
                .unwrap()
                .into_iter()
                .map(|m| m.id)
                .collect()
        }

        fn pack_bytes(&self) -> Vec<u8> {
            pack::pack_store(&self.store, KEY, &kdf_json(), &self.scratch).unwrap()
        }
    }

    impl LocalVault for Device {
        fn decode(&self, pack_bytes: &[u8]) -> Result<Vec<Record>> {
            decode_pack(pack_bytes, &kdf_json(), KEY, &self.scratch)
        }
        fn merge(&self, incoming: &[Record]) -> Result<usize> {
            self.store.merge_records(incoming).map_err(store_err)
        }
        fn digest(&self) -> Result<[u8; 32]> {
            self.store.state_digest().map_err(store_err)
        }
        fn pack(&self, cutoff_ms: i64) -> Result<Vec<u8>> {
            purge_and_pack(&self.store, KEY, &kdf_json(), &self.scratch, cutoff_ms)
        }
        fn note_push(&self, revision: &str, at_ms: i64) -> Result<()> {
            note_push(&self.store, revision, at_ms)
        }
    }

    #[derive(Default)]
    struct FakeDrive {
        content: Option<Vec<u8>>,
        revision: u64,
        uploads: usize,
        // Bumped by the test between a pull and the push that follows it, to
        // stand in for another device landing a snapshot mid-run.
        interlopers: Vec<Vec<u8>>,
    }

    #[derive(Default)]
    struct FakeRemote {
        state: Mutex<FakeDrive>,
    }

    impl FakeRemote {
        fn with(bytes: Vec<u8>) -> Self {
            let remote = Self::default();
            remote.put(bytes);
            remote
        }

        // A direct write, as another device's push would look.
        fn put(&self, bytes: Vec<u8>) {
            let mut state = self.state.lock().unwrap();
            state.revision += 1;
            state.content = Some(bytes);
        }

        // Land `bytes` on the drive the next time the engine reads the head —
        // i.e. exactly in the pull/push window.
        fn interlope(&self, bytes: Vec<u8>) {
            self.state.lock().unwrap().interlopers.push(bytes);
        }

        fn uploads(&self) -> usize {
            self.state.lock().unwrap().uploads
        }

        fn content(&self) -> Option<Vec<u8>> {
            self.state.lock().unwrap().content.clone()
        }
    }

    impl Remote for FakeRemote {
        fn fetch(&self) -> Result<Option<RemoteFile>> {
            let state = self.state.lock().unwrap();
            Ok(state.content.clone().map(|bytes| RemoteFile {
                bytes,
                revision: state.revision.to_string(),
            }))
        }

        fn head_revision(&self) -> Result<Option<String>> {
            let mut state = self.state.lock().unwrap();
            if let Some(bytes) = state.interlopers.pop() {
                state.revision += 1;
                state.content = Some(bytes);
            }
            Ok(state.content.is_some().then(|| state.revision.to_string()))
        }

        fn upload(&self, bytes: &[u8]) -> Result<String> {
            let mut state = self.state.lock().unwrap();
            state.revision += 1;
            state.uploads += 1;
            state.content = Some(bytes.to_vec());
            Ok(state.revision.to_string())
        }
    }

    // Read a drive's contents back as records, using a scratch dir of its own.
    fn remote_records(remote: &FakeRemote) -> Vec<Record> {
        let unpacked = pack::unpack(&remote.content().unwrap()).unwrap();
        records_from_snapshot(&unpacked.snapshot, KEY, &tmp_dir()).unwrap()
    }

    #[test]
    fn an_empty_remote_gets_the_first_push() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let remote = FakeRemote::default();

        let outcome = sync(&remote, &a, NOW).unwrap();

        assert_eq!(
            outcome,
            SyncOutcome {
                merged: 0,
                pushed: true
            }
        );
        assert_eq!(remote_records(&remote), a.store.export_for_sync().unwrap());
    }

    #[test]
    fn two_devices_converge_in_both_directions() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let b = Device::new();
        let remote = FakeRemote::default();

        // A publishes; B, empty, adopts it.
        sync(&remote, &a, NOW).unwrap();
        let outcome = sync(&remote, &b, NOW).unwrap();
        assert_eq!(outcome.merged, 1);
        assert!(!outcome.pushed, "B matched the remote exactly");
        assert_eq!(
            b.store.state_digest().unwrap(),
            a.store.state_digest().unwrap()
        );

        // B edits and pushes; A picks it up on its next run.
        b.store.import(&[record("2", 300, b"two")]).unwrap();
        assert!(sync(&remote, &b, NOW).unwrap().pushed);

        let outcome = sync(&remote, &a, NOW).unwrap();
        assert_eq!(outcome.merged, 1);
        assert!(!outcome.pushed);
        assert_eq!(a.ids(), vec!["1", "2"]);
        assert_eq!(
            a.store.state_digest().unwrap(),
            b.store.state_digest().unwrap()
        );
    }

    #[test]
    fn a_second_run_with_nothing_to_do_uploads_nothing() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let remote = FakeRemote::default();

        sync(&remote, &a, NOW).unwrap();
        let outcome = sync(&remote, &a, NOW).unwrap();

        assert_eq!(
            outcome,
            SyncOutcome {
                merged: 0,
                pushed: false
            }
        );
        assert_eq!(remote.uploads(), 1);
    }

    // F1. Another device pushed a state derived from a stale pull, clobbering
    // ours. Merging it back adds nothing here — every incoming row loses — so
    // any "did the merge change anything" heuristic would call this in sync and
    // leave our entry missing from the remote for good.
    #[test]
    fn a_remote_that_is_a_strict_subset_of_local_is_still_pushed() {
        let a = Device::seeded(&[record("1", 200, b"one"), record("2", 300, b"two")]);
        let remote = FakeRemote::default();
        sync(&remote, &a, NOW).unwrap();

        // A stale device overwrites the drive with a state that predates
        // record 2 (and knows an older record 1).
        let stale = Device::seeded(&[record("1", 100, b"older")]);
        remote.put(stale.pack_bytes());

        let outcome = sync(&remote, &a, NOW).unwrap();

        assert_eq!(
            outcome.merged, 0,
            "nothing on the remote is newer than local"
        );
        assert!(outcome.pushed, "but the remote is missing record 2");
        assert_eq!(remote.uploads(), 2);

        let published: Vec<String> = remote_records(&remote).into_iter().map(|r| r.id).collect();
        assert_eq!(published, vec!["1", "2"]);
        assert_eq!(
            state_digest(&remote_records(&remote)),
            a.store.state_digest().unwrap()
        );
    }

    #[test]
    fn a_push_that_loses_a_race_re_pulls_and_uploads_the_union() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let remote = FakeRemote::default();
        sync(&remote, &a, NOW).unwrap();

        // A has something new to push...
        a.store.import(&[record("2", 400, b"two")]).unwrap();
        // ...but C lands its own snapshot in the pull/push window.
        let c = Device::seeded(&[record("1", 200, b"one"), record("3", 500, b"three")]);
        remote.interlope(c.pack_bytes());

        let outcome = sync(&remote, &a, NOW).unwrap();

        assert!(outcome.pushed);
        assert_eq!(
            outcome.merged, 1,
            "C's record was merged on the second pass"
        );
        let published: Vec<String> = remote_records(&remote).into_iter().map(|r| r.id).collect();
        assert_eq!(published, vec!["1", "2", "3"], "the union, not either side");
    }

    #[test]
    fn a_remote_that_never_stops_moving_errors_instead_of_spinning() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let remote = FakeRemote::default();
        sync(&remote, &a, NOW).unwrap();
        a.store.import(&[record("2", 400, b"two")]).unwrap();

        // One interloper per attempt, plus one to spare.
        let c = Device::seeded(&[record("9", 900, b"nine")]);
        for _ in 0..MAX_ATTEMPTS + 1 {
            remote.interlope(c.pack_bytes());
        }

        assert!(sync(&remote, &a, NOW).is_err());
        assert_eq!(remote.uploads(), 1, "only the very first push ever landed");
    }

    #[test]
    fn a_truncated_remote_errors_and_leaves_the_local_vault_alone() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let before = a.store.state_digest().unwrap();

        let good = Device::seeded(&[record("2", 300, b"two")]).pack_bytes();
        let remote = FakeRemote::with(good[..good.len() / 2].to_vec());

        assert!(sync(&remote, &a, NOW).is_err());
        assert_eq!(a.store.state_digest().unwrap(), before);
        assert_eq!(a.ids(), vec!["1"]);
        assert_eq!(remote.uploads(), 0);
    }

    #[test]
    fn a_remote_we_cannot_decrypt_errors_and_leaves_the_local_vault_alone() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let before = a.store.state_digest().unwrap();

        // Structurally a pack, but the snapshot is not our database.
        let remote = FakeRemote::with(pack::pack(&kdf_json(), &[0xab; 4096]));

        match sync(&remote, &a, NOW) {
            Err(Error::Other(msg)) => assert_eq!(msg, "Remote vault file is invalid"),
            other => panic!("expected an invalid-remote error, got {other:?}"),
        }
        assert_eq!(a.store.state_digest().unwrap(), before);
        assert_eq!(remote.uploads(), 0);
    }

    #[test]
    fn a_pack_from_another_install_is_named_as_such_not_as_corruption() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let foreign = KdfParams::argon2id(b"a-completely-different-salt-here", 256, 1, 1)
            .to_json()
            .unwrap();
        let remote = FakeRemote::with(pack::pack(&foreign, &[0u8; 4096]));

        match sync(&remote, &a, NOW) {
            Err(Error::Other(msg)) => assert_eq!(msg, FOREIGN_VAULT),
            other => panic!("expected the foreign-vault error, got {other:?}"),
        }
        assert_eq!(remote.uploads(), 0);
    }

    #[test]
    fn a_remote_from_a_future_build_says_update_the_app() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let before = a.store.state_digest().unwrap();

        let future = Device::seeded(&[record("2", 300, b"two")]);
        future.store.set_user_version(99).unwrap();
        let remote = FakeRemote::with(future.pack_bytes());

        match sync(&remote, &a, NOW) {
            Err(Error::VaultTooNew) => {}
            other => panic!("expected VaultTooNew, got {other:?}"),
        }
        assert_eq!(a.store.state_digest().unwrap(), before);
        assert_eq!(remote.uploads(), 0);
    }

    #[test]
    fn a_pack_stamped_with_an_unknown_format_says_update_the_app() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let mut bytes = Device::seeded(&[record("2", 300, b"two")]).pack_bytes();
        bytes[4] = 2; // the format byte

        match sync(&FakeRemote::with(bytes), &a, NOW) {
            Err(Error::VaultTooNew) => {}
            other => panic!("expected VaultTooNew, got {other:?}"),
        }
    }

    #[test]
    fn an_expired_tombstone_is_reclaimed_and_a_fresh_one_propagates() {
        let a = Device::seeded(&[
            record("live", 200, b"live"),
            tombstone("ancient", NOW - 100 * DAY_MS),
            tombstone("recent", NOW - DAY_MS),
        ]);
        let remote = FakeRemote::default();

        sync(&remote, &a, NOW).unwrap();

        let published: Vec<String> = remote_records(&remote).into_iter().map(|r| r.id).collect();
        assert_eq!(
            published,
            vec!["live", "recent"],
            "the 90-day-old tombstone is gone"
        );

        // The fresh tombstone reaches a peer that still holds the entry as live.
        let b = Device::seeded(&[record("recent", 100, b"stale copy")]);
        sync(&remote, &b, NOW).unwrap();
        assert_eq!(b.ids(), vec!["live"], "the delete propagated");
    }

    #[test]
    fn a_completed_push_records_the_revision_it_landed_at() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let remote = FakeRemote::default();

        sync(&remote, &a, NOW).unwrap();

        assert_eq!(
            a.store.meta_get(META_REMOTE_REV).unwrap(),
            Some("1".to_string())
        );
        assert_eq!(
            a.store.meta_get(META_LAST_MS).unwrap(),
            Some(NOW.to_string())
        );
    }

    #[test]
    fn a_local_edit_that_only_loses_the_merge_still_leaves_the_vaults_equal() {
        // Both devices edit the same entry with the same timestamp; the content
        // hash decides, and it decides the same way on both sides.
        let a = Device::seeded(&[record("1", 500, b"from-a")]);
        let b = Device::seeded(&[record("1", 500, b"from-b")]);
        let remote = FakeRemote::default();

        sync(&remote, &a, NOW).unwrap();
        sync(&remote, &b, NOW).unwrap();
        sync(&remote, &a, NOW).unwrap();
        sync(&remote, &b, NOW).unwrap();

        assert_eq!(
            a.store.state_digest().unwrap(),
            b.store.state_digest().unwrap()
        );
        // Converged: neither side has anything left to say.
        assert!(!sync(&remote, &a, NOW).unwrap().pushed);
        assert!(!sync(&remote, &b, NOW).unwrap().pushed);
    }

    #[test]
    fn the_scratch_directory_is_empty_once_a_run_finishes() {
        let a = Device::seeded(&[record("1", 200, b"one")]);
        let remote = FakeRemote::default();

        sync(&remote, &a, NOW).unwrap();
        sync(&remote, &a, NOW).unwrap();

        assert!(fs::read_dir(&a.scratch).unwrap().next().is_none());
    }
}
