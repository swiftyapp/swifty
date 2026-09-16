use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Mutex;

use serde::Serialize;

#[cfg(mobile)]
use crate::crypto::Cryptor;
use crate::session::Session;

/// Why a mobile consent flow was started — which decides what happens once the
/// redirect comes back, and which events the frontend is told through.
#[cfg(mobile)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthPurpose {
    /// Turn sync on for the vault that is open now.
    Connect,
    /// Connect, then merge in whatever the account already holds.
    Import,
    /// First-run onboarding: connect an account *before* any vault exists, so
    /// the user can be shown what is up there and choose to restore it or start
    /// over. Alone among the three, it has no session and no cryptor.
    Setup,
}

/// A mobile consent flow waiting for the browser to come back.
///
/// The OAuth redirect arrives as a deep link long after `sync_connect`
/// returned, so what the exchange needs has to survive in between: the PKCE
/// verifier the code is redeemed with, the cryptor the tokens are written
/// under, and why the flow was started. Holding the cryptor is the same bargain
/// the desktop path already makes — it clones one before opening the browser
/// and keeps it for the whole round trip — and it is what lets an auto-lock
/// behind the Safari sheet cost the user nothing worse than the follow-up sync.
///
/// The cryptor is optional because [`AuthPurpose::Setup`] runs on an install
/// with no vault: there is no key in existence to seal a token file with, so
/// those tokens land in [`AppState::pending_drive`] instead.
///
/// It has an identity and an age. The `state` nonce went out in the consent URL
/// and must come back on the redirect, so a stray URL on the same scheme cannot
/// consume this in place of Google's callback; `started` is what lets a flow
/// nobody finished expire instead of pending forever.
#[cfg(mobile)]
pub struct PendingAuth {
    pub verifier: String,
    pub state: String,
    pub cryptor: Option<Cryptor>,
    pub purpose: AuthPurpose,
    pub started: std::time::Instant,
}

/// Sync as the frontend sees it. Every transition in `commands::sync` updates
/// this and re-emits the whole thing as `sync:status`, so the frontend mirrors
/// one value instead of reconstructing it from an order of events. Process
/// lifetime, not session: a lock does not un-happen the last successful run.
#[derive(Default)]
pub struct SyncRun {
    /// A consent flow is out with the browser.
    pub pending: bool,
    pub in_progress: bool,
    /// What the last connect or run failed with, until the next one starts.
    pub error: Option<String>,
    /// RFC 3339 time of the last run that succeeded in this process.
    pub last_synced_at: Option<String>,
    /// How many transitions this run state has been through. Every snapshot
    /// carries it, so two of them can be put in order by whoever holds them.
    pub seq: u64,
}

impl SyncRun {
    /// Record a transition. Every change goes through here so the sequence
    /// advances with it; a snapshot taken before the change reads as older.
    pub fn transition(&mut self, change: impl FnOnce(&mut SyncRun)) {
        change(self);
        self.seq += 1;
    }

    /// The snapshot the frontend gets. `configured` is the session's to answer,
    /// so the caller supplies it.
    pub fn status(&self, configured: bool) -> SyncStatus {
        SyncStatus {
            configured,
            pending: self.pending,
            in_progress: self.in_progress,
            error: self.error.clone(),
            last_synced_at: self.last_synced_at.clone(),
            seq: self.seq,
        }
    }
}

/// The whole of what the frontend knows about sync, carried by every
/// `sync:status` event and by the launch probe. Owned here, not by the
/// frontend — the backend is what starts and ends every flow, so it is the one
/// that can say.
///
/// Two snapshots can reach the frontend out of order: a probe taken just
/// before a transition, resolving after the event that transition emitted.
/// `seq` is what lets the frontend keep the newer one without guessing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    /// This vault has a provider connected.
    pub configured: bool,
    pub pending: bool,
    pub in_progress: bool,
    pub error: Option<String>,
    pub last_synced_at: Option<String>,
    /// Monotonic within the process; see [`SyncRun::seq`].
    pub seq: u64,
}

pub struct AppState {
    pub session: Mutex<Session>,
    /// Which workspace every vault path resolves to right now.
    ///
    /// Held in memory rather than read from the registry on each path lookup:
    /// it is consulted on essentially every file access, and it is also what
    /// keeps a switch atomic — the session is cleared and this is set together,
    /// so nothing can address one workspace's database with another's key.
    pub active_workspace: Mutex<String>,
    /// Held while the paths move (`commands::workspace`) and while a sync run or
    /// consent flow claims them (`commands::sync`): the flow takes its key and
    /// raises its flag under this lock, and a switch checks those flags and
    /// moves `active_workspace` under it, so neither can slip in between the
    /// other's check and its act. Never held across I/O.
    pub workspace_lock: Mutex<()>,
    // A sync run is in flight. Held outside `session` on purpose: the run takes
    // and releases the session lock repeatedly (never across a network call),
    // so the "one at a time" guard cannot live behind that same lock.
    pub syncing: AtomicBool,
    /// Which Drive connection is current, and the guard on the token file.
    ///
    /// A token refresh reads the file, awaits a network round trip, and writes
    /// the refreshed tokens back — and cannot hold a lock across that await
    /// (see `workspace_lock`). A disconnect landing in that window would
    /// otherwise have its delete undone by the write-back, leaving the account
    /// connected again at the next unlock. So the refresh reads this before the
    /// round trip and writes back only if it is unchanged — with the compare and
    /// the write under this lock, as are the disconnect's bump and delete, and
    /// the password change's re-seal. A bare compare would leave a gap between
    /// it and the write for the disconnect to land in. Held across local file
    /// operations only, never a network call.
    pub sync_generation: Mutex<u64>,
    /// Sync as reported to the frontend; also what `commands::workspace` reads
    /// to refuse a switch while a consent flow or a run is out.
    pub sync_run: Mutex<SyncRun>,
    /// Drive tokens for an account connected during first-run onboarding.
    ///
    /// Memory only, and deliberately so: they are sealed under the vault key,
    /// and on a fresh install that key does not exist yet. They live here from
    /// the moment consent is granted until the restore or create that follows
    /// produces a key to write them under (or the user backs out, which drops
    /// them). Outside `session` because there is no session to put them in.
    pub pending_drive: Mutex<Option<crate::sync::Tokens>>,
    /// A first-run create or restore is writing the vault. Same shape as
    /// `syncing`: the check for "no vault yet" and the writes that follow it
    /// are not one step, so two overlapping requests could both pass the check
    /// and interleave a database with the other's KDF sidecar.
    pub setup_busy: AtomicBool,
    /// Which first-run Drive connect is current. Bumped when one starts and
    /// again when the user backs out, so a consent that completes after it was
    /// abandoned can tell it is stale and drop its tokens instead of adopting
    /// an account the user already walked away from.
    pub setup_attempt: AtomicU64,
    #[cfg(mobile)]
    pub pending_auth: Mutex<Option<PendingAuth>>,
    /// How long a resumed app waits for a redirect before writing the pending
    /// consent flow off (`commands::sync::on_resume`). One re-armable timer
    /// rather than a sleeping thread per activation; the latest resume wins.
    #[cfg(mobile)]
    pub consent_grace: std::sync::Arc<crate::timer::Timer>,
}

// Hand-written only because `active_workspace` starts at the primary rather than
// at `String::default()`. `lib.rs` overwrites it from the registry at startup.
impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::default(),
            active_workspace: Mutex::new(crate::workspace::PRIMARY_ID.to_string()),
            workspace_lock: Mutex::default(),
            syncing: AtomicBool::default(),
            sync_generation: Mutex::default(),
            sync_run: Mutex::default(),
            pending_drive: Mutex::default(),
            setup_busy: AtomicBool::default(),
            setup_attempt: AtomicU64::default(),
            #[cfg(mobile)]
            pending_auth: Mutex::default(),
            #[cfg(mobile)]
            consent_grace: crate::timer::Timer::spawn(),
        }
    }
}
