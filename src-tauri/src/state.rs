use std::sync::Mutex;
use zeroize::Zeroizing;

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::models::VaultData;

// In-memory session. The master key never leaves Rust; the frontend only ever
// receives decrypted vault data for display. `vault` caches the exposed
// (plaintext) entries so state-only commands (read_vault, get_audit) work
// without re-reading disk.
#[derive(Default)]
pub struct Session {
    // Wrapped in `Zeroizing` so the key is scrubbed from the heap on drop and
    // whenever it's replaced or cleared (auto-lock / explicit lock).
    pub master_key: Option<Zeroizing<Vec<u8>>>,
    pub vault: Option<VaultData>,
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

    // Store the derived key and exposed vault for this session.
    pub fn set(&mut self, secret: String, vault: VaultData, sync_configured: bool) {
        self.master_key = Some(Zeroizing::new(secret.into_bytes()));
        self.vault = Some(vault);
        self.sync_configured = sync_configured;
    }

    // Drop the in-memory key and data. Used by the inactivity auto-lock.
    pub fn clear(&mut self) {
        self.master_key = None;
        self.vault = None;
        self.sync_configured = false;
    }
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Session>,
}
