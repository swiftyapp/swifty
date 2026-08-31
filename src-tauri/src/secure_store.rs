//! OS secure store for the vault key material, biometric-gated.
//!
//! The stored value is opaque key material — today the `Cryptor` "secret"
//! string, tomorrow (Phase 2) an Argon2id-derived key — so this module never
//! interprets it. The biometric gate model differs per platform:
//!
//! - **macOS:** a Keychain item with a `SecAccessControl` requiring biometry
//!   (`kSecAccessControlBiometryCurrentSet`). The OS enforces Touch ID on *read*
//!   and auto-invalidates the item if the enrolled fingerprints change.
//! - **Windows:** stored in Credential Manager; retrieval is gated by a
//!   Windows Hello prompt first (verify-then-read).
//! - **other (Linux, …):** unsupported — we report biometric unavailable rather
//!   than store a key that nothing can gate.

use crate::error::{Error, Result};
use zeroize::Zeroizing;

// Used only by the macOS/Windows key-store impls; absent on the unsupported
// fallback (Linux), so gate them to avoid a dead_code error there.
#[cfg(any(target_os = "macos", target_os = "windows"))]
const SERVICE: &str = "pro.getswifty.app.vault";
#[cfg(any(target_os = "macos", target_os = "windows"))]
const ACCOUNT: &str = "master-key";

/// Abstraction over the platform key store so the non-interactive unlock logic
/// is unit-testable with an in-memory mock (biometric prompts can't run headlessly).
pub trait KeyStore {
    /// Store `key` biometry-gated. Opt-in; call while unlocked.
    fn store(&self, key: &[u8]) -> Result<()>;
    /// Retrieve the key, triggering the platform biometric gate.
    /// Fails with [`Error::NotFound`] when nothing is enrolled.
    fn retrieve(&self) -> Result<Zeroizing<Vec<u8>>>;
    /// Delete the stored key. Idempotent (a missing key is not an error).
    fn delete(&self) -> Result<()>;
}

/// The real, platform-backed key store.
pub struct Platform;

impl KeyStore for Platform {
    fn store(&self, key: &[u8]) -> Result<()> {
        imp::store(key)
    }
    fn retrieve(&self) -> Result<Zeroizing<Vec<u8>>> {
        imp::retrieve()
    }
    fn delete(&self) -> Result<()> {
        imp::delete()
    }
}

/// Whether this platform can biometric-gate the secure store at all.
pub fn is_supported() -> bool {
    imp::SUPPORTED
}

#[cfg(target_os = "macos")]
mod imp {
    use super::*;
    use security_framework::passwords::{
        delete_generic_password_options, generic_password, set_generic_password_options,
        AccessControlOptions, PasswordOptions,
    };

    pub const SUPPORTED: bool = true;

    // errSecItemNotFound — no such keychain item.
    const ERR_ITEM_NOT_FOUND: i32 = -25300;

    fn options() -> PasswordOptions {
        let mut opts = PasswordOptions::new_generic_password(SERVICE, ACCOUNT);
        // The data-protection keychain is required for biometric access control.
        opts.use_protected_keychain();
        opts
    }

    pub fn store(key: &[u8]) -> Result<()> {
        // Delete first: updating an existing biometry-protected item would itself
        // require an auth prompt, but adding a fresh one does not.
        let _ = delete();
        let mut opts = options();
        opts.set_access_control_options(AccessControlOptions::BIOMETRY_CURRENT_SET);
        set_generic_password_options(key, opts).map_err(map_err)
    }

    pub fn retrieve() -> Result<Zeroizing<Vec<u8>>> {
        // Requesting the data triggers the OS Touch ID prompt via the stored
        // SecAccessControl (OS-enforced-on-read).
        let bytes = generic_password(options()).map_err(map_err)?;
        Ok(Zeroizing::new(bytes))
    }

    pub fn delete() -> Result<()> {
        match delete_generic_password_options(options()) {
            Ok(()) => Ok(()),
            Err(e) if e.code() == ERR_ITEM_NOT_FOUND => Ok(()),
            Err(e) => Err(map_err(e)),
        }
    }

    fn map_err(e: security_framework::base::Error) -> Error {
        if e.code() == ERR_ITEM_NOT_FOUND {
            Error::NotFound
        } else {
            Error::Other(e.to_string())
        }
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::*;
    use crate::biometrics;
    use keyring::{Entry, Error as KrError};

    pub const SUPPORTED: bool = true;

    fn entry() -> Result<Entry> {
        Entry::new(SERVICE, ACCOUNT).map_err(|e| Error::Other(e.to_string()))
    }

    pub fn store(key: &[u8]) -> Result<()> {
        entry()?
            .set_secret(key)
            .map_err(|e| Error::Other(e.to_string()))
    }

    pub fn retrieve() -> Result<Zeroizing<Vec<u8>>> {
        // Verify-then-read: gate the Credential Manager read behind Windows Hello.
        biometrics::authenticate()?;
        match entry()?.get_secret() {
            Ok(bytes) => Ok(Zeroizing::new(bytes)),
            Err(KrError::NoEntry) => Err(Error::NotFound),
            Err(e) => Err(Error::Other(e.to_string())),
        }
    }

    pub fn delete() -> Result<()> {
        match entry()?.delete_credential() {
            Ok(()) | Err(KrError::NoEntry) => Ok(()),
            Err(e) => Err(Error::Other(e.to_string())),
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    use super::*;

    pub const SUPPORTED: bool = false;

    fn unsupported() -> Error {
        Error::Other("biometric secure store is not supported on this platform".into())
    }

    pub fn store(_key: &[u8]) -> Result<()> {
        Err(unsupported())
    }
    pub fn retrieve() -> Result<Zeroizing<Vec<u8>>> {
        Err(unsupported())
    }
    pub fn delete() -> Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    // In-memory stand-in for the OS secure store (no biometric prompt).
    #[derive(Default)]
    struct MockStore {
        key: RefCell<Option<Vec<u8>>>,
    }

    impl KeyStore for MockStore {
        fn store(&self, key: &[u8]) -> Result<()> {
            *self.key.borrow_mut() = Some(key.to_vec());
            Ok(())
        }
        fn retrieve(&self) -> Result<Zeroizing<Vec<u8>>> {
            self.key
                .borrow()
                .clone()
                .map(Zeroizing::new)
                .ok_or(Error::NotFound)
        }
        fn delete(&self) -> Result<()> {
            *self.key.borrow_mut() = None;
            Ok(())
        }
    }

    #[test]
    fn store_then_retrieve_roundtrips_the_key() {
        let secret = crate::crypto::hash_secret("hunter2");
        let store = MockStore::default();
        store.store(secret.as_bytes()).unwrap();
        assert_eq!(&*store.retrieve().unwrap(), secret.as_bytes());
    }

    #[test]
    fn restore_overwrites_a_stale_key() {
        // change_master_password re-stores the new material over the old.
        let store = MockStore::default();
        store
            .store(crate::crypto::hash_secret("old-pass").as_bytes())
            .unwrap();
        let new = crate::crypto::hash_secret("new-pass");
        store.store(new.as_bytes()).unwrap();
        assert_eq!(&*store.retrieve().unwrap(), new.as_bytes());
    }

    #[test]
    fn delete_makes_retrieve_not_found() {
        let store = MockStore::default();
        store.store(b"k").unwrap();
        store.delete().unwrap();
        assert!(matches!(store.retrieve(), Err(Error::NotFound)));
    }
}
