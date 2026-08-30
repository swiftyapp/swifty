pub mod audit;
pub mod auth;
pub mod clipboard;
pub mod generator;
pub mod sync;
pub mod vault;

use crate::crypto::Cryptor;
use crate::error::Result;
use crate::models::Entry;

// Decrypt every entry's sensitive fields (obscured on disk -> plaintext).
pub fn expose_all(cryptor: &Cryptor, entries: &[Entry]) -> Result<Vec<Entry>> {
    entries.iter().map(|e| cryptor.expose(e)).collect()
}

// Encrypt every entry's sensitive fields (plaintext -> obscured for disk).
pub fn obscure_all(cryptor: &Cryptor, entries: &[Entry]) -> Result<Vec<Entry>> {
    entries.iter().map(|e| cryptor.obscure(e)).collect()
}
