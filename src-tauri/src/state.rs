use std::sync::Mutex;
use zeroize::Zeroizing;

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::store::SqliteStore;

// In-memory session. The master key never leaves Rust; the frontend only ever
// receives non-secret entry metadata for the list and one decrypted entry at a
// time (reveal). The open, encrypted store handle lives here — not a decrypted
// vault — so plaintext secrets are never all held in memory.
#[derive(Default)]
pub struct Session {
    // Wrapped in `Zeroizing` so the key is scrubbed from the heap on drop and
    // whenever it's replaced or cleared (auto-lock / explicit lock).
    pub master_key: Option<Zeroizing<Vec<u8>>>,
    // The open SQLCipher store. Dropped (connection closed) on lock.
    pub store: Option<SqliteStore>,
    pub sync_configured: bool,
}

impl Session {
    pub fn is_unlocked(&self) -> bool {
        self.master_key.is_some()
    }

    // Rebuild a Cryptor from the held key, or fail if locked.
    pub fn cryptor(&self) -> Result<Cryptor> {
        let key = self.master_key.as_ref().ok_or(Error::Locked)?;
        let secret = std::str::from_utf8(key).map_err(|e| Error::Crypto(e.to_string()))?;
        Ok(Cryptor::new(secret))
    }

    // Borrow the open store, or fail if locked.
    pub fn store(&self) -> Result<&SqliteStore> {
        self.store.as_ref().ok_or(Error::Locked)
    }

    // Adopt the derived key and open store for this session.
    pub fn set(&mut self, secret: String, store: SqliteStore, sync_configured: bool) {
        self.master_key = Some(Zeroizing::new(secret.into_bytes()));
        self.store = Some(store);
        self.sync_configured = sync_configured;
    }

    // Drop the in-memory key and close the store. Used by the inactivity auto-lock.
    pub fn clear(&mut self) {
        self.master_key = None;
        self.store = None;
        self.sync_configured = false;
    }
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Session>,
}
