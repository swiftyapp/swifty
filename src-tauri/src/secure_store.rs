//! OS secure store for the vault key material, biometric-gated.
//!
//! The stored value is opaque key material — today the `Cryptor` "secret"
//! string, tomorrow (Phase 2) an Argon2id-derived key — so this module never
//! interprets it. The biometric gate model differs per platform, and on macOS
//! it differs per *build*, so the gate in force is named by a [`GateMode`]:
//!
//! - [`GateMode::Protected`] (macOS only): a data-protection Keychain item with
//!   a `SecAccessControl` requiring biometry (`kSecAccessControlBiometryCurrentSet`).
//!   The OS enforces Touch ID on *read* and auto-invalidates the item if the
//!   enrolled fingerprints change. Adding such an item requires the
//!   `keychain-access-groups` entitlement, so it only works in a properly
//!   signed build — an ad-hoc-signed dev build gets `errSecMissingEntitlement`.
//! - [`GateMode::Prompt`]: verify-then-read. The app runs an explicit biometric
//!   check ([`crate::biometrics::authenticate`]) and only then reads the key
//!   from an ordinary credential-store item (macOS login keychain / Windows
//!   Credential Manager). The gate is app-enforced rather than OS-enforced —
//!   the same model the Windows path has always used, and the same one the
//!   legacy Electron app used via keytar.
//! - **other (Linux, …):** unsupported — we report biometric unavailable rather
//!   than store a key that nothing can gate.
//!
//! The mode is decided **once, at enrollment** ([`KeyStore::store`]), recorded
//! by the caller alongside the enrollment marker, and passed back in on every
//! [`KeyStore::retrieve`]. Retrieval never re-probes and never tries the other
//! mode: silently degrading from an OS-enforced gate to an app-enforced one
//! would weaken the user's protection without telling them, and silently
//! *upgrading* would just fail to find the item. A mode mismatch surfaces as an
//! error the user can act on (re-enroll) instead of a quiet downgrade.

use crate::error::{Error, Result};
use zeroize::Zeroizing;

// Used only by the macOS/Windows key-store impls; absent on the unsupported
// fallback (Linux), so gate them to avoid a dead_code error there.
#[cfg(any(target_os = "macos", target_os = "windows"))]
const SERVICE: &str = "pro.getswifty.app.vault";
#[cfg(any(target_os = "macos", target_os = "windows"))]
const ACCOUNT: &str = "master-key";
// Separate account for the verify-then-read item on macOS. The two modes live in
// different keychains with different access control, so they must never be able
// to resolve each other's item: a distinct account makes a cross-mode read a
// clean `NotFound` rather than an item read under the wrong gate.
#[cfg(target_os = "macos")]
const ACCOUNT_PROMPT: &str = "master-key-prompt";

/// How an enrolled key is gated. Recorded at enrollment; never re-derived.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateMode {
    /// OS-enforced on read (macOS data-protection keychain + `SecAccessControl`).
    Protected,
    /// App-enforced: explicit biometric prompt, then a plain credential-store read.
    Prompt,
}

impl GateMode {
    /// The marker value persisted next to the enrollment flag. Stable on disk —
    /// changing these strings orphans existing enrollments.
    pub fn as_marker(self) -> &'static str {
        match self {
            Self::Protected => "protected",
            Self::Prompt => "prompt",
        }
    }

    /// Read a persisted marker. Anything unrecognised — including the legacy
    /// `"1"` marker written before modes existed — reads as the mode that build
    /// would have used, so an old enrollment keeps working (or fails loudly)
    /// rather than being reinterpreted under a gate it was never stored behind.
    pub fn from_marker(marker: &str) -> Self {
        match marker.trim() {
            "prompt" => Self::Prompt,
            "protected" => Self::Protected,
            _ => Self::LEGACY,
        }
    }

    // Pre-mode enrollments: macOS only ever wrote the protected item, every
    // other platform only ever wrote the verify-then-read one.
    #[cfg(target_os = "macos")]
    const LEGACY: Self = Self::Protected;
    #[cfg(not(target_os = "macos"))]
    const LEGACY: Self = Self::Prompt;
}

/// Abstraction over the platform key store so the non-interactive unlock logic
/// is unit-testable with an in-memory mock (biometric prompts can't run headlessly).
pub trait KeyStore {
    /// Store `key` biometry-gated, returning the [`GateMode`] actually used.
    /// Opt-in; call while unlocked. The caller must persist the returned mode.
    fn store(&self, key: &[u8]) -> Result<GateMode>;
    /// Retrieve the key through `mode`'s gate — and only that one.
    /// Fails with [`Error::NotFound`] when nothing is enrolled under it.
    fn retrieve(&self, mode: GateMode) -> Result<Zeroizing<Vec<u8>>>;
    /// Delete the stored key in *every* mode. Idempotent (a missing key is not
    /// an error), so disabling or re-enrolling can never orphan the other item.
    fn delete(&self) -> Result<()>;
}

/// The real, platform-backed key store.
pub struct Platform;

impl KeyStore for Platform {
    fn store(&self, key: &[u8]) -> Result<GateMode> {
        imp::store(key)
    }
    fn retrieve(&self, mode: GateMode) -> Result<Zeroizing<Vec<u8>>> {
        imp::retrieve(mode)
    }
    fn delete(&self) -> Result<()> {
        imp::delete()
    }
}

/// Whether this platform can biometric-gate the secure store at all.
pub fn is_supported() -> bool {
    imp::SUPPORTED
}

/// Outcome of a protected-mode store attempt, classified so the enrollment
/// policy below can be expressed — and tested — without a real keychain.
#[cfg(any(target_os = "macos", test))]
enum ProtectedOutcome {
    Stored,
    /// The platform refused for lack of a code-signing entitlement. Recoverable:
    /// the build simply isn't signed for the data-protection keychain.
    NoEntitlement,
    /// Anything else — a real failure, not a capability gap.
    Failed(Error),
}

// Enrollment policy: prefer the OS-enforced gate, fall back to the app-enforced
// one *only* for the one recoverable reason (no entitlement). Every other
// failure propagates: a keychain that is broken rather than unentitled must not
// quietly hand the user a weaker gate than the one they'd otherwise have got.
#[cfg(any(target_os = "macos", test))]
fn enroll(
    protected: impl FnOnce() -> ProtectedOutcome,
    prompt: impl FnOnce() -> Result<()>,
) -> Result<GateMode> {
    match protected() {
        ProtectedOutcome::Stored => Ok(GateMode::Protected),
        ProtectedOutcome::NoEntitlement => prompt().map(|()| GateMode::Prompt),
        ProtectedOutcome::Failed(e) => Err(e),
    }
}

#[cfg(target_os = "macos")]
mod imp {
    use super::*;
    use crate::biometrics;
    use security_framework::passwords::{
        delete_generic_password_options, generic_password, set_generic_password_options,
        AccessControlOptions, PasswordOptions,
    };

    pub const SUPPORTED: bool = true;

    // errSecItemNotFound — no such keychain item.
    const ERR_ITEM_NOT_FOUND: i32 = -25300;
    // errSecMissingEntitlement — the data-protection keychain rejected the item
    // because the binary lacks `keychain-access-groups`. Matched by OSStatus, not
    // by message text, which is localized.
    const ERR_MISSING_ENTITLEMENT: i32 = -34018;

    // Data-protection keychain: the only one that honours a biometric
    // SecAccessControl, and the only one that needs an entitlement.
    fn protected_options() -> PasswordOptions {
        let mut opts = PasswordOptions::new_generic_password(SERVICE, ACCOUNT);
        opts.use_protected_keychain();
        opts
    }

    // Ordinary login keychain: no access control, no entitlement, no OS gate.
    // The biometric check happens in `retrieve` before we ever read this.
    fn prompt_options() -> PasswordOptions {
        PasswordOptions::new_generic_password(SERVICE, ACCOUNT_PROMPT)
    }

    pub fn store(key: &[u8]) -> Result<GateMode> {
        // Clear both modes first. Adding a fresh item never prompts, whereas
        // *updating* a biometry-protected one would; and a leftover item in the
        // mode we don't end up using would outlive the enrollment it belongs to.
        let _ = delete();
        enroll(
            || {
                let mut opts = protected_options();
                opts.set_access_control_options(AccessControlOptions::BIOMETRY_CURRENT_SET);
                match set_generic_password_options(key, opts) {
                    Ok(()) => ProtectedOutcome::Stored,
                    Err(e) if e.code() == ERR_MISSING_ENTITLEMENT => {
                        ProtectedOutcome::NoEntitlement
                    }
                    Err(e) => ProtectedOutcome::Failed(map_err(e)),
                }
            },
            || set_generic_password_options(key, prompt_options()).map_err(map_err),
        )
    }

    pub fn retrieve(mode: GateMode) -> Result<Zeroizing<Vec<u8>>> {
        let bytes = match mode {
            // Requesting the data triggers the OS Touch ID prompt via the stored
            // SecAccessControl (OS-enforced-on-read).
            GateMode::Protected => generic_password(protected_options()).map_err(map_err)?,
            // Verify-then-read: the gate is ours, so it must run first.
            GateMode::Prompt => {
                biometrics::authenticate()?;
                generic_password(prompt_options()).map_err(map_err)?
            }
        };
        Ok(Zeroizing::new(bytes))
    }

    pub fn delete() -> Result<()> {
        delete_one(protected_options())?;
        delete_one(prompt_options())
    }

    fn delete_one(opts: PasswordOptions) -> Result<()> {
        match delete_generic_password_options(opts) {
            Ok(()) => Ok(()),
            Err(e) if e.code() == ERR_ITEM_NOT_FOUND => Ok(()),
            Err(e) => Err(map_err(e)),
        }
    }

    fn map_err(e: security_framework::base::Error) -> Error {
        match e.code() {
            ERR_ITEM_NOT_FOUND => Error::NotFound,
            // Distinct from NotFound on purpose: the item may well still exist,
            // this build just can't reach it. Callers must not treat it as "the
            // enrollment is gone" and delete the marker (see `unlock_biometric`).
            ERR_MISSING_ENTITLEMENT => Error::Other(
                "this build is not entitled to read the protected keychain item; \
                 re-enable biometric unlock to re-enroll"
                    .into(),
            ),
            _ => Error::Other(e.to_string()),
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

    // Credential Manager has no OS-enforced biometric gate, so Windows is always
    // verify-then-read — there is no protected mode to prefer or fall back from.
    pub fn store(key: &[u8]) -> Result<GateMode> {
        entry()?
            .set_secret(key)
            .map_err(|e| Error::Other(e.to_string()))?;
        Ok(GateMode::Prompt)
    }

    // `mode` is always `Prompt` here (see `store`); the read path is unconditional.
    pub fn retrieve(_mode: GateMode) -> Result<Zeroizing<Vec<u8>>> {
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

    pub fn store(_key: &[u8]) -> Result<GateMode> {
        Err(unsupported())
    }
    pub fn retrieve(_mode: GateMode) -> Result<Zeroizing<Vec<u8>>> {
        Err(unsupported())
    }
    pub fn delete() -> Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    // In-memory stand-in for the OS secure store (no biometric prompt). Keeps a
    // slot per mode so a cross-mode read is observably a miss, exactly as it is
    // on disk where the two modes are different keychain items.
    #[derive(Default)]
    struct MockStore {
        protected: RefCell<Option<Vec<u8>>>,
        prompt: RefCell<Option<Vec<u8>>>,
        // Simulates an ad-hoc-signed build: the protected keychain refuses.
        no_entitlement: Cell<bool>,
    }

    impl MockStore {
        fn unentitled() -> Self {
            let s = Self::default();
            s.no_entitlement.set(true);
            s
        }
        fn slot(&self, mode: GateMode) -> &RefCell<Option<Vec<u8>>> {
            match mode {
                GateMode::Protected => &self.protected,
                GateMode::Prompt => &self.prompt,
            }
        }
    }

    impl KeyStore for MockStore {
        fn store(&self, key: &[u8]) -> Result<GateMode> {
            self.delete()?;
            let no_entitlement = self.no_entitlement.get();
            enroll(
                || {
                    if no_entitlement {
                        ProtectedOutcome::NoEntitlement
                    } else {
                        *self.protected.borrow_mut() = Some(key.to_vec());
                        ProtectedOutcome::Stored
                    }
                },
                || {
                    *self.prompt.borrow_mut() = Some(key.to_vec());
                    Ok(())
                },
            )
        }
        fn retrieve(&self, mode: GateMode) -> Result<Zeroizing<Vec<u8>>> {
            self.slot(mode)
                .borrow()
                .clone()
                .map(Zeroizing::new)
                .ok_or(Error::NotFound)
        }
        fn delete(&self) -> Result<()> {
            *self.protected.borrow_mut() = None;
            *self.prompt.borrow_mut() = None;
            Ok(())
        }
    }

    #[test]
    fn store_then_retrieve_roundtrips_the_key() {
        let secret = crate::crypto::hash_secret("hunter2");
        let store = MockStore::default();
        let mode = store.store(secret.as_bytes()).unwrap();
        assert_eq!(mode, GateMode::Protected);
        assert_eq!(&*store.retrieve(mode).unwrap(), secret.as_bytes());
    }

    #[test]
    fn restore_overwrites_a_stale_key() {
        // change_master_password re-stores the new material over the old.
        let store = MockStore::default();
        store
            .store(crate::crypto::hash_secret("old-pass").as_bytes())
            .unwrap();
        let new = crate::crypto::hash_secret("new-pass");
        let mode = store.store(new.as_bytes()).unwrap();
        assert_eq!(&*store.retrieve(mode).unwrap(), new.as_bytes());
    }

    #[test]
    fn delete_makes_retrieve_not_found() {
        let store = MockStore::default();
        let mode = store.store(b"k").unwrap();
        store.delete().unwrap();
        assert!(matches!(store.retrieve(mode), Err(Error::NotFound)));
    }

    #[test]
    fn an_unentitled_build_enrolls_in_prompt_mode() {
        let store = MockStore::unentitled();
        assert_eq!(store.store(b"k").unwrap(), GateMode::Prompt);
        assert_eq!(&*store.retrieve(GateMode::Prompt).unwrap(), b"k");
    }

    #[test]
    fn retrieval_never_falls_through_to_the_other_mode() {
        // The recorded mode is the only one consulted. Reading a prompt-mode
        // enrollment as protected (or vice versa) must miss, not silently
        // succeed through the weaker/other gate.
        let store = MockStore::unentitled();
        assert_eq!(store.store(b"k").unwrap(), GateMode::Prompt);
        assert!(matches!(
            store.retrieve(GateMode::Protected),
            Err(Error::NotFound)
        ));

        let store = MockStore::default();
        assert_eq!(store.store(b"k").unwrap(), GateMode::Protected);
        assert!(matches!(
            store.retrieve(GateMode::Prompt),
            Err(Error::NotFound)
        ));
    }

    #[test]
    fn re_enrollment_leaves_no_orphan_in_the_other_mode() {
        // Enroll protected, then re-enroll as an unentitled build would: the
        // protected item must be gone, not left behind holding stale material.
        let store = MockStore::default();
        store.store(b"old").unwrap();
        store.no_entitlement.set(true);
        assert_eq!(store.store(b"new").unwrap(), GateMode::Prompt);
        assert!(store.protected.borrow().is_none());
        assert_eq!(&*store.retrieve(GateMode::Prompt).unwrap(), b"new");
    }

    #[test]
    fn enroll_prefers_protected_and_never_calls_the_fallback() {
        let fallback_ran = Cell::new(false);
        let mode = enroll(
            || ProtectedOutcome::Stored,
            || {
                fallback_ran.set(true);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(mode, GateMode::Protected);
        assert!(!fallback_ran.get(), "protected succeeded; no fallback");
    }

    #[test]
    fn enroll_propagates_a_non_entitlement_failure() {
        // A broken keychain must not be quietly downgraded to the weaker gate.
        let fallback_ran = Cell::new(false);
        let result = enroll(
            || ProtectedOutcome::Failed(Error::Other("keychain is on fire".into())),
            || {
                fallback_ran.set(true);
                Ok(())
            },
        );
        assert!(matches!(result, Err(Error::Other(m)) if m == "keychain is on fire"));
        assert!(!fallback_ran.get(), "only NoEntitlement falls back");
    }

    #[test]
    fn gate_mode_markers_round_trip() {
        for mode in [GateMode::Protected, GateMode::Prompt] {
            assert_eq!(GateMode::from_marker(mode.as_marker()), mode);
        }
        // A pre-mode marker reads as whatever that build actually wrote.
        assert_eq!(GateMode::from_marker("1"), GateMode::LEGACY);
        assert_eq!(GateMode::from_marker(""), GateMode::LEGACY);
    }

    // --- Real-keychain probes -------------------------------------------------
    //
    // #[ignore]d: they touch this machine's actual login/data-protection
    // keychains, so CI never runs them. They use their own service/account so
    // they can never collide with a real enrollment, and clean up after
    // themselves. Run with: cargo test -- --ignored probe_
    #[cfg(target_os = "macos")]
    mod probes {
        use security_framework::passwords::{
            delete_generic_password_options, set_generic_password_options, AccessControlOptions,
            PasswordOptions,
        };

        const PROBE_SERVICE: &str = "pro.getswifty.app.probe";

        #[test]
        #[ignore = "touches the real keychain"]
        fn probe_protected_store_reports_its_status() {
            let mut opts = PasswordOptions::new_generic_password(PROBE_SERVICE, "probe-protected");
            opts.use_protected_keychain();
            opts.set_access_control_options(AccessControlOptions::BIOMETRY_CURRENT_SET);
            let result = set_generic_password_options(b"probe", opts);
            match &result {
                Ok(()) => println!("protected store: OK (this build is entitled)"),
                Err(e) => println!("protected store: code {} ({e})", e.code()),
            }
            if result.is_ok() {
                let mut opts =
                    PasswordOptions::new_generic_password(PROBE_SERVICE, "probe-protected");
                opts.use_protected_keychain();
                let _ = delete_generic_password_options(opts);
            }
        }

        #[test]
        #[ignore = "touches the real keychain"]
        fn probe_prompt_store_and_delete_roundtrip() {
            // Store + delete only: retrieval would need a real fingerprint.
            let opts = PasswordOptions::new_generic_password(PROBE_SERVICE, "probe-prompt");
            set_generic_password_options(b"probe", opts).expect("plain login-keychain store");
            let opts = PasswordOptions::new_generic_password(PROBE_SERVICE, "probe-prompt");
            delete_generic_password_options(opts).expect("plain login-keychain delete");
            println!("prompt store + delete: OK");
        }
    }
}
