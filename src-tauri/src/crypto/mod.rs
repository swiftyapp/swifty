//! Crypto core. Byte-compatible with the legacy `@swiftyapp/cryptor` vault format:
//! `hex( salt[64] ‖ iv[16] ‖ tag[16] ‖ ciphertext )` per value, wrapped in base64
//! for whole-object blobs. See `legacy/src/main/application/cryptor/index.js`.

use aes_gcm::aead::consts::U16;
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::aes::Aes256;
use aes_gcm::{AesGcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::Hmac;
use rand::RngCore;
use serde::{de::DeserializeOwned, Serialize};
use sha2::{Digest, Sha512};

use crate::error::{Error, Result};
use crate::models::Entry;

#[cfg(test)]
mod tests;

// The vault uses a 16-byte GCM nonce, not the 12-byte Rust default. A 12-byte
// assumption silently fails to decrypt every existing vault.
type Aes256Gcm16 = AesGcm<Aes256, U16>;

const SALT_LEN: usize = 64;
const IV_LEN: usize = 16;
const TAG_LEN: usize = 16;
const ITERATIONS: u32 = 100_000;
const KEY_LEN: usize = 32;

/// `base64( SHA512(pw) )` — the "secret" fed to the cryptor.
pub fn hash_secret(password: &str) -> String {
    STANDARD.encode(Sha512::digest(password.as_bytes()))
}

fn err<E: std::fmt::Display>(e: E) -> Error {
    Error::Crypto(e.to_string())
}

pub struct Cryptor {
    secret: Vec<u8>,
}

impl Cryptor {
    pub fn new(secret: &str) -> Self {
        Self {
            secret: secret.as_bytes().to_vec(),
        }
    }

    fn cipher(&self, salt: &[u8]) -> Result<Aes256Gcm16> {
        let mut key = [0u8; KEY_LEN];
        pbkdf2::pbkdf2::<Hmac<Sha512>>(&self.secret, salt, ITERATIONS, &mut key).map_err(err)?;
        Aes256Gcm16::new_from_slice(&key).map_err(err)
    }

    /// Encrypt to `hex( salt ‖ iv ‖ tag ‖ ciphertext )`.
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        let mut rng = rand::thread_rng();
        let mut salt = [0u8; SALT_LEN];
        let mut iv = [0u8; IV_LEN];
        rng.fill_bytes(&mut salt);
        rng.fill_bytes(&mut iv);

        let cipher = self.cipher(&salt)?;
        let payload = Payload {
            msg: plaintext.as_bytes(),
            aad: &[],
        };
        // aes-gcm returns `ciphertext ‖ tag`; the vault format wants the tag before it.
        let sealed = cipher
            .encrypt(Nonce::from_slice(&iv), payload)
            .map_err(err)?;
        let (ciphertext, tag) = sealed.split_at(sealed.len() - TAG_LEN);

        let mut out = Vec::with_capacity(SALT_LEN + IV_LEN + TAG_LEN + ciphertext.len());
        out.extend_from_slice(&salt);
        out.extend_from_slice(&iv);
        out.extend_from_slice(tag);
        out.extend_from_slice(ciphertext);
        Ok(hex::encode(out))
    }

    /// Reverse of [`encrypt`](Self::encrypt).
    pub fn decrypt(&self, hexstr: &str) -> Result<String> {
        let bytes = hex::decode(hexstr).map_err(err)?;
        if bytes.len() < SALT_LEN + IV_LEN + TAG_LEN {
            return Err(Error::Crypto("ciphertext too short".into()));
        }
        let (salt, rest) = bytes.split_at(SALT_LEN);
        let (iv, rest) = rest.split_at(IV_LEN);
        let (tag, ciphertext) = rest.split_at(TAG_LEN);

        // Reassemble `ciphertext ‖ tag` for aes-gcm.
        let mut sealed = Vec::with_capacity(ciphertext.len() + TAG_LEN);
        sealed.extend_from_slice(ciphertext);
        sealed.extend_from_slice(tag);

        let cipher = self.cipher(salt)?;
        let payload = Payload {
            msg: &sealed,
            aad: &[],
        };
        let plain = cipher
            .decrypt(Nonce::from_slice(iv), payload)
            .map_err(err)?;
        String::from_utf8(plain).map_err(err)
    }

    /// `base64( encrypt( JSON.stringify(data) ) )` — the on-disk blob (double-encoded).
    pub fn encrypt_data<T: Serialize>(&self, data: &T) -> Result<String> {
        let json = serde_json::to_string(data)?;
        Ok(STANDARD.encode(self.encrypt(&json)?))
    }

    /// Reverse of [`encrypt_data`](Self::encrypt_data).
    pub fn decrypt_data<T: DeserializeOwned>(&self, blob: &str) -> Result<T> {
        let hexstr = String::from_utf8(STANDARD.decode(blob).map_err(err)?).map_err(err)?;
        Ok(serde_json::from_str(&self.decrypt(&hexstr)?)?)
    }

    /// Encrypt an entry's sensitive fields in place, each stored as raw hex.
    pub fn obscure(&self, entry: &Entry) -> Result<Entry> {
        self.transform(entry, |v| self.encrypt(v))
    }

    /// Decrypt an entry's sensitive fields in place.
    pub fn expose(&self, entry: &Entry) -> Result<Entry> {
        self.transform(entry, |v| self.decrypt(v))
    }

    fn transform(&self, entry: &Entry, f: impl Fn(&str) -> Result<String>) -> Result<Entry> {
        let mut e = entry.clone();
        let slots: Vec<&mut Option<String>> = match e.kind.as_str() {
            "login" => vec![&mut e.password, &mut e.otp],
            "note" => vec![&mut e.note],
            "card" => vec![&mut e.pin],
            _ => vec![],
        };
        for slot in slots {
            let value = slot.take().unwrap_or_default();
            // Empty/absent fields stay "".
            *slot = Some(if value.is_empty() {
                String::new()
            } else {
                f(&value)?
            });
        }
        Ok(e)
    }
}
