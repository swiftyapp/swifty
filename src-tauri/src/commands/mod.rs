pub mod audit;
pub mod auth;
pub mod clipboard;
pub mod generator;
pub mod sync;
pub mod vault;

use crate::crypto::Cryptor;
use crate::error::Result;
use crate::models::Entry;

// Decrypt one entry's sensitive fields (legacy per-field ciphertext -> plaintext).
// Decryption is lazy (per entry, on reveal/edit) so plaintext secrets are never
// all held in memory at once — matching the original app.
pub fn expose_all(cryptor: &Cryptor, entries: &[Entry]) -> Result<Vec<Entry>> {
    entries.iter().map(|e| cryptor.expose(e)).collect()
}

// Encrypt one entry's sensitive fields (plaintext -> obscured for disk).
pub fn obscure_all(cryptor: &Cryptor, entries: &[Entry]) -> Result<Vec<Entry>> {
    entries.iter().map(|e| cryptor.obscure(e)).collect()
}
