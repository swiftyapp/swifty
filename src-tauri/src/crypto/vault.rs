//! Session key material and the per-entry payload cipher.
//!
//! A vault is keyed one of two ways, resolved at unlock by the presence of the
//! KDF sidecar (`vault.kdf.json`):
//!
//! - [`VaultKey::Argon2`] — the current scheme. The master password is fed
//!   **directly** to Argon2id (no `hash_secret` pre-hash); the 32-byte output is
//!   HKDF-split into a SQLCipher key and a payload key. Payloads are sealed with
//!   AES-256-GCM under the payload key ([`PayloadCipher::Aead`]) — one AEAD per
//!   entry, no per-payload KDF.
//! - [`VaultKey::Legacy`] — back-compat for interim/dev DBs created before the
//!   Argon2id wiring, which have no sidecar. Keeps the old deterministic
//!   SQLCipher key and the per-field PBKDF2 [`Cryptor`] payload format so those
//!   vaults still open.

use base64::{engine::general_purpose::STANDARD, Engine};
use zeroize::Zeroizing;

use super::{hash_secret, hkdf_subkey, seal_aead, sqlcipher_key, unseal_aead, Cryptor, KEY_LEN};
use crate::error::{Error, Result};
use crate::models::Entry;

// HKDF `info` labels — one master key, three independent subkeys.
const INFO_SQLCIPHER: &[u8] = b"sqlcipher-db-key";
const INFO_PAYLOAD: &[u8] = b"payload-aead-key";
// The gdrive/sync token blob is encrypted with a legacy `Cryptor`; give it a
// stable, install-specific secret derived from the master so the (disabled) sync
// path keeps a self-consistent cipher without holding the password.
const INFO_LEGACY_CRYPTOR: &[u8] = b"legacy-cryptor-secret";

/// The active vault key. Held by the session; scrubbed on drop.
pub enum VaultKey {
    /// Argon2id master key (32 bytes of KDF output).
    Argon2 { master: Zeroizing<Vec<u8>> },
    /// Legacy `hash_secret(password)` string bytes (sidecar-less DBs only).
    Legacy { secret: Zeroizing<Vec<u8>> },
}

impl VaultKey {
    /// Build the legacy key material for a password (the deterministic pre-Argon2
    /// scheme). Used only when a DB exists without a sidecar.
    pub fn legacy_from_password(password: &str) -> Self {
        Self::Legacy {
            secret: Zeroizing::new(hash_secret(password).into_bytes()),
        }
    }

    /// The 32-byte SQLCipher key for this vault.
    pub fn sqlcipher_key(&self) -> [u8; KEY_LEN] {
        match self {
            Self::Argon2 { master } => hkdf_subkey(master, INFO_SQLCIPHER),
            Self::Legacy { secret } => sqlcipher_key(&secret_str(secret)),
        }
    }

    /// The cipher that seals/unseals per-entry payloads for this vault.
    pub fn payload_cipher(&self) -> PayloadCipher {
        match self {
            Self::Argon2 { master } => {
                PayloadCipher::Aead(Zeroizing::new(hkdf_subkey(master, INFO_PAYLOAD)))
            }
            Self::Legacy { secret } => PayloadCipher::Legacy(Cryptor::new(&secret_str(secret))),
        }
    }

    /// A legacy `Cryptor` for the gdrive/sync token blob (sync only).
    pub fn cryptor(&self) -> Cryptor {
        match self {
            Self::Argon2 { master } => {
                Cryptor::new(&STANDARD.encode(hkdf_subkey(master, INFO_LEGACY_CRYPTOR)))
            }
            Self::Legacy { secret } => Cryptor::new(&secret_str(secret)),
        }
    }

    /// The opaque bytes to persist in the OS secure store for biometric unlock:
    /// the Argon2id master, or the legacy secret. Interpreted back by sidecar
    /// presence at unlock (see `unlock_biometric`).
    pub fn biometric_material(&self) -> &[u8] {
        match self {
            Self::Argon2 { master } => master,
            Self::Legacy { secret } => secret,
        }
    }
}

// The legacy secret is always UTF-8 (base64); fall back to empty on the
// impossible non-UTF-8 case rather than panic.
fn secret_str(secret: &[u8]) -> String {
    String::from_utf8_lossy(secret).into_owned()
}

/// Seals and unseals a single entry's payload. The stored payload is opaque
/// bytes; only this type knows the format.
pub enum PayloadCipher {
    /// AES-256-GCM over the plaintext entry JSON, keyed by the payload subkey.
    Aead(Zeroizing<[u8; KEY_LEN]>),
    /// Legacy double layer: per-field `obscure` then whole-entry `encrypt_data`.
    Legacy(Cryptor),
}

impl PayloadCipher {
    /// Seal a plaintext entry into its stored payload bytes.
    pub fn seal(&self, entry: &Entry) -> Result<Vec<u8>> {
        match self {
            Self::Aead(key) => seal_aead(&**key, &serde_json::to_vec(entry)?),
            Self::Legacy(c) => Ok(c.encrypt_data(&c.obscure(entry)?)?.into_bytes()),
        }
    }

    /// Unseal stored payload bytes back into a plaintext entry.
    pub fn unseal(&self, payload: &[u8]) -> Result<Entry> {
        match self {
            Self::Aead(key) => Ok(serde_json::from_slice(&unseal_aead(&**key, payload)?)?),
            Self::Legacy(c) => {
                let blob =
                    std::str::from_utf8(payload).map_err(|e| Error::Crypto(e.to_string()))?;
                let obscured: Entry = c.decrypt_data(blob)?;
                c.expose(&obscured)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry() -> Entry {
        serde_json::from_value(serde_json::json!({
            "id": "1", "type": "login", "title": "Site",
            "website": "https://ex.com/login", "username": "alice",
            "password": "s3cret", "otp": "SEED", "tags": ["work"]
        }))
        .unwrap()
    }

    fn argon2_key() -> VaultKey {
        VaultKey::Argon2 {
            master: Zeroizing::new(vec![7u8; KEY_LEN]),
        }
    }

    #[test]
    fn argon2_split_keys_are_distinct() {
        let k = argon2_key();
        let sql = k.sqlcipher_key();
        let PayloadCipher::Aead(payload) = k.payload_cipher() else {
            panic!("argon2 vault must use the AEAD payload cipher");
        };
        assert_ne!(sql, *payload, "sqlcipher and payload subkeys must differ");
    }

    #[test]
    fn aead_payload_round_trips_under_payload_key() {
        let cipher = argon2_key().payload_cipher();
        let sealed = cipher.seal(&entry()).unwrap();
        // The plaintext secret never appears in the sealed bytes.
        assert!(!sealed.windows(6).any(|w| w == b"s3cret"));
        let back = cipher.unseal(&sealed).unwrap();
        assert_eq!(back.password.as_deref(), Some("s3cret"));
        assert_eq!(back.otp.as_deref(), Some("SEED"));
        assert_eq!(back.username.as_deref(), Some("alice"));
    }

    #[test]
    fn aead_reseal_uses_a_fresh_nonce() {
        let cipher = argon2_key().payload_cipher();
        assert_ne!(
            cipher.seal(&entry()).unwrap(),
            cipher.seal(&entry()).unwrap(),
            "each seal must use a fresh random nonce"
        );
    }

    #[test]
    fn wrong_payload_key_fails_to_unseal() {
        let sealed = argon2_key().payload_cipher().seal(&entry()).unwrap();
        let other = VaultKey::Argon2 {
            master: Zeroizing::new(vec![9u8; KEY_LEN]),
        };
        assert!(other.payload_cipher().unseal(&sealed).is_err());
    }

    #[test]
    fn legacy_payload_round_trips() {
        let cipher = VaultKey::legacy_from_password("pw").payload_cipher();
        let sealed = cipher.seal(&entry()).unwrap();
        let back = cipher.unseal(&sealed).unwrap();
        assert_eq!(back.password.as_deref(), Some("s3cret"));
    }

    fn entry_with_passkey() -> Entry {
        Entry {
            passkeys: Some(vec![crate::models::Passkey {
                credential_id: "Y3JlZDE".into(),
                rp_id: "ex.com".into(),
                rp_name: Some("Example".into()),
                user_handle: "dWgx".into(),
                user_name: "alice".into(),
                user_display_name: "Alice".into(),
                private_key: "cHJpdmF0ZUtleQ".into(),
                counter: 3,
                created_at: Some("2024-01-01T00:00:00Z".into()),
            }]),
            ..entry()
        }
    }

    // Both payload ciphers carry passkeys through untouched — the legacy one
    // obscures only the named secret fields, so this is the check that its
    // per-field pass does not drop the new list.
    #[test]
    fn aead_payload_round_trips_passkeys() {
        let cipher = argon2_key().payload_cipher();
        let sealed = cipher.seal(&entry_with_passkey()).unwrap();
        // The private key never appears in the sealed bytes.
        let secret = b"cHJpdmF0ZUtleQ";
        assert!(!sealed.windows(secret.len()).any(|w| w == secret));
        let back = cipher.unseal(&sealed).unwrap();
        assert_eq!(back.passkeys, entry_with_passkey().passkeys);
    }

    #[test]
    fn legacy_payload_round_trips_passkeys() {
        let cipher = VaultKey::legacy_from_password("pw").payload_cipher();
        let sealed = cipher.seal(&entry_with_passkey()).unwrap();
        let back = cipher.unseal(&sealed).unwrap();
        assert_eq!(back.passkeys, entry_with_passkey().passkeys);
    }

    // The `.swftx` path: `export_entry`'s obscure + the import path's expose,
    // under a second Cryptor, must leave passkeys byte-identical.
    #[test]
    fn legacy_obscure_expose_preserves_passkeys() {
        let out = Cryptor::new("backup-password");
        let obscured = out.obscure(&entry_with_passkey()).unwrap();
        let back = out.expose(&obscured).unwrap();
        assert_eq!(back.passkeys, entry_with_passkey().passkeys);
    }
}
