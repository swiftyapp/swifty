use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Mutex;

use crate::crypto::{Cryptor, PayloadCipher, VaultKey};
use crate::error::{Error, Result};
use crate::store::SqliteStore;

// In-memory session. The vault key never leaves Rust; the frontend only ever
// receives non-secret entry metadata for the list and one decrypted entry at a
// time (reveal). The open, encrypted store handle lives here — not a decrypted
// vault — so plaintext secrets are never all held in memory.
#[derive(Default)]
pub struct Session {
    // The active vault key (Argon2id master or legacy secret). It owns its own
    // zeroize-on-drop, so the material is scrubbed on lock/clear/replace.
    pub key: Option<VaultKey>,
    // The open SQLCipher store. Dropped (connection closed) on lock.
    pub store: Option<SqliteStore>,
    pub sync_configured: bool,
}

impl Session {
    pub fn is_unlocked(&self) -> bool {
        self.key.is_some()
    }

    // The held vault key, or fail if locked.
    pub fn key(&self) -> Result<&VaultKey> {
        self.key.as_ref().ok_or(Error::Locked)
    }

    // The per-entry payload cipher for this session, or fail if locked.
    pub fn payload_cipher(&self) -> Result<PayloadCipher> {
        Ok(self.key()?.payload_cipher())
    }

    // The legacy Cryptor for the (disabled) gdrive/sync token blob.
    pub fn cryptor(&self) -> Result<Cryptor> {
        Ok(self.key()?.cryptor())
    }

    // Borrow the open store, or fail if locked.
    pub fn store(&self) -> Result<&SqliteStore> {
        self.store.as_ref().ok_or(Error::Locked)
    }

    // Adopt the derived key and open store for this session.
    pub fn set(&mut self, key: VaultKey, store: SqliteStore, sync_configured: bool) {
        self.key = Some(key);
        self.store = Some(store);
        self.sync_configured = sync_configured;
    }

    // Re-adopt a key + store, leaving sync_configured untouched. Used by
    // change-master-password's success and rollback paths, where the store is
    // taken out of the session and later put back (or replaced by a restore).
    pub fn set_keyed(&mut self, key: VaultKey, store: SqliteStore) {
        self.key = Some(key);
        self.store = Some(store);
    }

    // Drop the in-memory key and close the store. Used by the inactivity auto-lock.
    pub fn clear(&mut self) {
        self.key = None;
        self.store = None;
        self.sync_configured = false;
    }
}

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

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Session>,
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
