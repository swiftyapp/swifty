//! The WebAuthn authenticator: registers ("make credential") and signs in
//! ("get assertion") with passkeys held inside sealed login entries.
//!
//! The ceremony logic itself is 1Password's `passkey-rs`; this module supplies
//! the two things it leaves to the vendor — where credentials are stored
//! ([`store::PasskeyVault`]) and how the user is verified ([`UnlockedSession`]).
//! Deliberately free of Tauri types and of any notion of transport: a later PR
//! adds the browser-extension host that feeds requests in.
//!
//! ## User verification
//! An unlocked vault *is* the user verification, so [`UnlockedSession`] reports
//! both presence and verification unconditionally — it can only be constructed
//! from an unlocked session in the first place. That makes registering and
//! signing in silent, which is the weakest acceptable stance and only tenable
//! because nothing can reach this module yet: the extension PR adds the
//! per-ceremony confirm prompt and replaces the check with its answer.
//!
//! ## Signature counters
//! Passkeys here sync between devices, so a per-device counter would look like
//! a cloned authenticator to any relying party that tracks it. New credentials
//! are therefore created with the constant zero the WebAuthn spec recommends
//! for that case and are never incremented on sign-in. A credential imported
//! with a non-zero counter keeps counting, since its previous owner already
//! taught the relying party to expect that.

// The public surface is the engine for the browser-extension PR, which is the
// first caller; nothing in the app invokes it yet.
#![allow(dead_code)]

pub mod key;
pub mod store;

#[cfg(test)]
mod tests;

use passkey_authenticator::{UserCheck, UserValidationMethod};
use passkey_types::ctap2::{get_assertion, make_credential, Aaguid, Ctap2Error, StatusCode};

use crate::error::{Error, Result};

use store::{PasskeyVault, VaultCredentialStore};

/// Swifty's AAGUID — `8f2b41d7-6c93-4e1a-a50d-37e8b16429c5`, a UUIDv4 generated
/// once for this crate. One fixed identifier for "the Swifty desktop
/// authenticator", the same on every install: it names the model, never the
/// device, because a per-install value would be a handle for correlating a user
/// across relying parties.
pub const AAGUID: Aaguid = Aaguid([
    0x8f, 0x2b, 0x41, 0xd7, 0x6c, 0x93, 0x4e, 0x1a, 0xa5, 0x0d, 0x37, 0xe8, 0xb1, 0x64, 0x29, 0xc5,
]);

/// The CTAP2 authenticator type this module builds.
pub type Ctap2Authenticator<V> =
    passkey_authenticator::Authenticator<VaultCredentialStore<V>, UnlockedSession>;

/// Registers and asserts passkeys against a [`PasskeyVault`].
pub struct Authenticator<V: PasskeyVault> {
    inner: Ctap2Authenticator<V>,
}

impl<V: PasskeyVault> Authenticator<V> {
    pub fn new(vault: V) -> Self {
        Self {
            inner: passkey_authenticator::Authenticator::new(
                AAGUID,
                VaultCredentialStore::new(vault),
                UnlockedSession,
            ),
        }
    }

    /// Registration: create a credential, store it on a login entry, and return
    /// the attestation the relying party asked for.
    pub async fn make_credential(
        &mut self,
        request: make_credential::Request,
    ) -> Result<make_credential::Response> {
        self.inner.make_credential(request).await.map_err(ctap_err)
    }

    /// Sign-in: assert an existing credential for the request's rpId.
    pub async fn get_assertion(
        &mut self,
        request: get_assertion::Request,
    ) -> Result<get_assertion::Response> {
        self.inner.get_assertion(request).await.map_err(ctap_err)
    }

    /// The vault this authenticator reads and writes.
    pub fn vault(&self) -> &V {
        self.inner.store().vault()
    }

    /// Hand the bare CTAP2 authenticator to a WebAuthn client (`passkey-client`)
    /// when the caller needs origin verification and clientDataJSON built for
    /// it, rather than raw CTAP2 requests.
    pub fn into_ctap2(self) -> Ctap2Authenticator<V> {
        self.inner
    }
}

/// User verification by way of the vault being unlocked. See the module docs.
pub struct UnlockedSession;

#[async_trait::async_trait]
impl UserValidationMethod for UnlockedSession {
    type PasskeyItem = passkey_types::Passkey;

    async fn check_user<'a>(
        &self,
        _credential: Option<&'a Self::PasskeyItem>,
        _presence: bool,
        _verification: bool,
    ) -> std::result::Result<UserCheck, Ctap2Error> {
        Ok(UserCheck {
            presence: true,
            verification: true,
        })
    }

    fn is_presence_enabled(&self) -> bool {
        true
    }

    fn is_verification_enabled(&self) -> Option<bool> {
        Some(true)
    }
}

// CTAP status codes carry no message; keep the code (it is the only detail a
// caller can act on) and let the log hold anything richer.
fn ctap_err(status: StatusCode) -> Error {
    Error::Other(format!("passkey ceremony failed: {status:?}"))
}
