use std::sync::Mutex;

// In-memory session. The master key never leaves Rust; the frontend only ever
// receives decrypted vault data for display. Later PRs fill in the key material.
#[derive(Default)]
pub struct Session {
    pub master_key: Option<Vec<u8>>,
}

impl Session {
    pub fn is_unlocked(&self) -> bool {
        self.master_key.is_some()
    }

    // Drop the in-memory key. Used by the inactivity auto-lock.
    pub fn clear(&mut self) {
        self.master_key = None;
    }
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Session>,
}
