use std::sync::Mutex;

// In-memory session. The master key never leaves Rust; the frontend only ever
// receives decrypted vault data for display. Later PRs fill in the key material.
#[derive(Default)]
pub struct Session {
    pub master_key: Option<Vec<u8>>,
}

impl Session {
    #[allow(dead_code)] // used by later PRs that implement the command bodies
    pub fn is_unlocked(&self) -> bool {
        self.master_key.is_some()
    }
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Session>,
}
