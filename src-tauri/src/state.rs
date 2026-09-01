use std::sync::atomic::AtomicBool;
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

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Session>,
    // A sync run is in flight. Held outside `session` on purpose: the run takes
    // and releases the session lock repeatedly (never across a network call),
    // so the "one at a time" guard cannot live behind that same lock.
    pub syncing: AtomicBool,
}
