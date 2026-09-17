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
//! An unlocked vault is the *identity* half of user verification: only the
//! holder of the master password (or the biometric) has one. The *intent*
//! half — that the user wants this registration or this sign-in to happen —
//! is asked for every ceremony through [`UserConsent`], which the transport
//! supplies when it builds the [`Authenticator`]. There is no default: nothing
//! can construct an authenticator without saying how the user is asked, so the
//! extension PR has to bring its confirm prompt with it rather than inherit a
//! silent yes. A refusal ends the ceremony as `OperationDenied`; presence and
//! verification are both reported only after an approval. The one ceremony
//! refused before the user is asked is a registration whose excludeCredentials
//! names a credential we already hold — `passkey-authenticator` leaves that
//! answer to the verification method.
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

use passkey_authenticator::{UiHint, UserCheck, UserValidationMethod};
use passkey_types::ctap2::{get_assertion, make_credential, Aaguid, Ctap2Error, StatusCode};

use crate::error::{Error, Result};

use store::{PasskeyVault, VaultCredentialStore};

/// Rowel's AAGUID — `8f2b41d7-6c93-4e1a-a50d-37e8b16429c5`, a UUIDv4 generated
/// once for this crate. One fixed identifier for "the Rowel desktop
/// authenticator", the same on every install: it names the model, never the
/// device, because a per-install value would be a handle for correlating a user
/// across relying parties.
pub const AAGUID: Aaguid = Aaguid([
    0x8f, 0x2b, 0x41, 0xd7, 0x6c, 0x93, 0x4e, 0x1a, 0xa5, 0x0d, 0x37, 0xe8, 0xb1, 0x64, 0x29, 0xc5,
]);

/// The CTAP2 authenticator type this module builds.
pub type Ctap2Authenticator<V> =
    passkey_authenticator::Authenticator<VaultCredentialStore<V>, UnlockedSession>;

/// What the user is being asked to approve, in the terms a prompt would show.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ceremony<'a> {
    /// Create a passkey for `rp_id`, for the account the site calls `user_name`.
    Register {
        rp_id: &'a str,
        user_name: Option<&'a str>,
    },
    /// Sign in to `rp_id` with a passkey the vault already holds.
    SignIn { rp_id: &'a str },
}

/// The user's say over a ceremony. `approve` runs before a key is created or a
/// signature made; `false` ends the ceremony as denied. Supplied by whatever
/// feeds requests in — the browser-extension host and its confirm sheet — and
/// blocking is fine: the authenticator runs off the UI thread.
pub trait UserConsent: Send + Sync {
    fn approve(&self, ceremony: Ceremony<'_>) -> bool;
}

/// Registers and asserts passkeys against a [`PasskeyVault`].
pub struct Authenticator<V: PasskeyVault> {
    inner: Ctap2Authenticator<V>,
}

impl<V: PasskeyVault> Authenticator<V> {
    pub fn new(vault: V, consent: impl UserConsent + 'static) -> Self {
        Self {
            inner: passkey_authenticator::Authenticator::new(
                AAGUID,
                VaultCredentialStore::new(vault),
                UnlockedSession {
                    consent: Box::new(consent),
                },
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

/// User verification: the vault is unlocked (or this could not have been
/// built), and the user approves each ceremony. See the module docs.
pub struct UnlockedSession {
    consent: Box<dyn UserConsent>,
}

#[async_trait::async_trait]
impl UserValidationMethod for UnlockedSession {
    type PasskeyItem = passkey_types::Passkey;

    async fn check_user<'a>(
        &self,
        hint: UiHint<'a, Self::PasskeyItem>,
        _presence: bool,
        _verification: bool,
    ) -> std::result::Result<UserCheck, Ctap2Error> {
        let approved = match hint {
            // `make_credential` no longer refuses an excludeCredentials hit
            // itself (passkey-authenticator 0.5 hands the decision here, so a
            // UI can say "you already have one"), so refusing is ours to do —
            // otherwise a second registration would silently store a duplicate
            // credential.
            UiHint::InformExcludedCredentialFound(_) => return Err(Ctap2Error::CredentialExcluded),
            // Nothing to approve: the library fails the ceremony on its own
            // once this returns.
            UiHint::InformNoCredentialsFound => true,
            UiHint::RequestNewCredential(user, rp) => self.consent.approve(Ceremony::Register {
                rp_id: &rp.id,
                user_name: user.name.as_deref(),
            }),
            UiHint::RequestExistingCredential(passkey) => self.consent.approve(Ceremony::SignIn {
                rp_id: &passkey.rp_id,
            }),
        };
        if !approved {
            return Err(Ctap2Error::OperationDenied);
        }
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
