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

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::models::VaultData;
use zeroize::Zeroizing;

const SERVICE: &str = "pro.getswifty.app.vault";
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

/// Retrieve the key material (triggering the biometric gate) and decrypt `blob`.
/// Returns the key (so the caller can seed the session) and the decrypted vault.
/// Shared by the real `unlock_biometric` command and its unit tests.
pub fn open_vault<S: KeyStore>(store: &S, blob: &str) -> Result<(Zeroizing<Vec<u8>>, VaultData)> {
    let key = store.retrieve()?;
    let secret = std::str::from_utf8(&key).map_err(|e| Error::Crypto(e.to_string()))?;
    let vault = Cryptor::new(secret)
        .decrypt_data(blob)
        .map_err(|_| Error::InvalidPassword)?;
    Ok((key, vault))
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
    use crate::models::Entry;
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

    fn sample_blob(secret: &str) -> String {
        let vault = VaultData {
            entries: vec![Entry {
                id: "1".into(),
                kind: "note".into(),
                title: "t".into(),
                username: None,
                password: None,
                website: None,
                email: None,
                otp: None,
                note: Some("hi".into()),
                number: None,
                month: None,
                year: None,
                cvc: None,
                pin: None,
                name: None,
                tags: None,
                created_at: None,
                updated_at: None,
                password_updated_at: None,
            }],
        };
        Cryptor::new(secret).encrypt_data(&vault).unwrap()
    }

    #[test]
    fn enable_retrieve_unlock_roundtrip() {
        let secret = crate::crypto::hash_secret("hunter2");
        let blob = sample_blob(&secret);
        let store = MockStore::default();

        // enable: store the session key material.
        store.store(secret.as_bytes()).unwrap();

        // unlock: retrieve the key (gated in production) and decrypt the vault.
        let (key, vault) = open_vault(&store, &blob).unwrap();
        assert_eq!(&*key, secret.as_bytes());
        assert_eq!(vault.entries.len(), 1);
        assert_eq!(vault.entries[0].id, "1");
    }

    #[test]
    fn wrong_key_fails_to_unlock() {
        let blob = sample_blob(&crate::crypto::hash_secret("hunter2"));
        let store = MockStore::default();
        store
            .store(crate::crypto::hash_secret("different").as_bytes())
            .unwrap();
        assert!(matches!(
            open_vault(&store, &blob),
            Err(Error::InvalidPassword)
        ));
    }

    #[test]
    fn change_password_invalidates_stored_key() {
        // After a re-key, unlocking with the OLD stored key must fail; re-storing
        // the NEW key restores biometric unlock.
        let old = crate::crypto::hash_secret("old-pass");
        let new = crate::crypto::hash_secret("new-pass");
        let new_blob = sample_blob(&new);
        let store = MockStore::default();

        store.store(old.as_bytes()).unwrap();
        assert!(matches!(
            open_vault(&store, &new_blob),
            Err(Error::InvalidPassword)
        ));

        // change_master_password re-stores the new key material.
        store.store(new.as_bytes()).unwrap();
        let (_, vault) = open_vault(&store, &new_blob).unwrap();
        assert_eq!(vault.entries.len(), 1);
    }

    #[test]
    fn delete_makes_retrieve_not_found() {
        let store = MockStore::default();
        store.store(b"k").unwrap();
        store.delete().unwrap();
        assert!(matches!(store.retrieve(), Err(Error::NotFound)));
    }
}
