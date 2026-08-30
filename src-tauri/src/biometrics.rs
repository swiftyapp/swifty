//! Biometric-unlock seam. PR-7 replaces these stub bodies with real
//! macOS (LocalAuthentication) / Windows (Hello) implementations. Keep the
//! signatures exactly as-is so the calling commands stay untouched.

use crate::error::Result;

pub fn is_available() -> bool {
    false
}

pub fn authenticate() -> Result<()> {
    Ok(())
}
