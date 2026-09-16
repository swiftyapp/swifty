use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Mutex;

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

pub struct AppState {
    pub session: Mutex<Session>,
    /// Which workspace every vault path resolves to right now.
    ///
    /// Held in memory rather than read from the registry on each path lookup:
    /// it is consulted on essentially every file access, and it is also what
    /// keeps a switch atomic — the session is cleared and this is set together,
    /// so nothing can address one workspace's database with another's key.
    pub active_workspace: Mutex<String>,
    // A sync run is in flight. Held outside `session` on purpose: the run takes
    // and releases the session lock repeatedly (never across a network call),
    // so the "one at a time" guard cannot live behind that same lock.
    pub syncing: AtomicBool,
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
}

// Hand-written only because `active_workspace` starts at the primary rather than
// at `String::default()`. `lib.rs` overwrites it from the registry at startup.
impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::default(),
            active_workspace: Mutex::new(crate::workspace::PRIMARY_ID.to_string()),
            syncing: AtomicBool::default(),
            pending_drive: Mutex::default(),
            setup_busy: AtomicBool::default(),
            setup_attempt: AtomicU64::default(),
            #[cfg(mobile)]
            pending_auth: Mutex::default(),
        }
    }
}
