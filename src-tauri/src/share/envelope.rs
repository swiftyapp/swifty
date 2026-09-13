//! The pure half of sharing: the one-time key, the sealed envelope, and the
//! link that carries both halves of what a recipient needs.
//!
//! Nothing here touches the network, the vault or Tauri. The key is generated
//! here and never leaves the sender's machine except inside the link, so Drive
//! only ever holds bytes it cannot read.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::error::{Error, Result};
use crate::models::Entry;

/// How long a share lives. Fixed rather than chosen: a share is meant to be
/// opened now, and a dial the sender has to think about is one more way to
/// leave a credential lying in someone else's Drive.
pub const SHARE_TTL_MS: i64 = 24 * 60 * 60 * 1000;

pub fn expires_at(now_ms: i64) -> i64 {
    now_ms + SHARE_TTL_MS
}

const KEY_LEN: usize = 32;
const VERSION: u8 = 1;
const PREFIX: &str = "swifty://share#";
const VERSION_TAG: &str = "v1";

/// The AES-256 key a single share is sealed under. Fresh per share, never
/// derived from the vault: losing it costs the recipient the share and nothing
/// else.
pub struct ShareKey(Zeroizing<[u8; KEY_LEN]>);

impl ShareKey {
    pub fn generate() -> Self {
        let mut key = Zeroizing::new([0u8; KEY_LEN]);
        rand::thread_rng().fill_bytes(&mut *key);
        Self(key)
    }
}

impl AsRef<[u8]> for ShareKey {
    fn as_ref(&self) -> &[u8] {
        &*self.0
    }
}

// The key is the whole secret of a share, and links get logged.
impl std::fmt::Debug for ShareKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ShareKey(redacted)")
    }
}

/// Strip everything the recipient's vault must decide for itself.
///
/// The id is theirs to assign, the timestamps describe the sender's copy, the
/// star is the sender's opinion, and a copied passkey would be a second
/// authenticator the site never registered. Everything else — tags, extra
/// fields, the secret itself — is the point of the share and travels intact.
pub fn sanitize(entry: &Entry) -> Entry {
    Entry {
        id: String::new(),
        created_at: None,
        updated_at: None,
        password_updated_at: None,
        favorite: false,
        passkeys: None,
        ..entry.clone()
    }
}

/// The sealed plaintext. `entry` is generic so the reader can check the version
/// before parsing it: a future format may shape the entry differently, and that
/// has to read as "newer version", not as a parse failure.
#[derive(Serialize, Deserialize)]
struct Envelope<E> {
    v: u8,
    entry: E,
}

pub fn seal(key: &ShareKey, entry: &Entry) -> Result<Vec<u8>> {
    let plaintext = serde_json::to_vec(&Envelope {
        v: VERSION,
        entry: &sanitize(entry),
    })?;
    crate::crypto::seal_aead(key.as_ref(), &plaintext)
}

pub fn unseal(key: &ShareKey, blob: &[u8]) -> Result<Entry> {
    // A wrong key and a tampered file are the same event to the user: the link
    // they have does not open this share. The AEAD error underneath says
    // nothing they can act on.
    let plaintext = crate::crypto::unseal_aead(key.as_ref(), blob)
        .map_err(|_| Error::Other("this link does not open the share".into()))?;

    let envelope: Envelope<serde_json::Value> = serde_json::from_slice(&plaintext)?;
    if envelope.v != VERSION {
        return Err(Error::Other(
            "this share was made by a newer version of Swifty".into(),
        ));
    }
    Ok(serde_json::from_value(envelope.entry)?)
}

/// A whole share in one pasteable token: `swifty://share#v1.<fileId>.<key>`.
///
/// One token rather than a URL with query parameters, because both halves have
/// to survive being pasted into a chat window by hand, and because a fragment
/// keeps the key out of anything that would forward the link to a server.
#[derive(Debug)]
pub struct Link {
    pub file_id: String,
    pub key: ShareKey,
}

impl Link {
    pub fn format(&self) -> String {
        format!(
            "{PREFIX}{VERSION_TAG}.{}.{}",
            self.file_id,
            URL_SAFE_NO_PAD.encode(self.key.as_ref())
        )
    }

    pub fn parse(s: &str) -> Result<Link> {
        let rest = s.trim().strip_prefix(PREFIX).ok_or_else(not_a_link)?;
        let mut parts = rest.split('.');

        let version = parts.next().unwrap_or_default();
        if version != VERSION_TAG {
            // A tag whose shape we recognize but whose number we don't can only
            // come from a build that speaks a format this one doesn't.
            return Err(if is_version_tag(version) {
                newer_version()
            } else {
                not_a_link()
            });
        }

        let file_id = parts.next().unwrap_or_default();
        let key = parts.next().ok_or_else(incomplete)?;
        if parts.next().is_some() {
            return Err(not_a_link());
        }

        if file_id.is_empty() {
            return Err(incomplete());
        }
        if !file_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err(not_a_link());
        }

        // Held zeroized on the way in: this is the key, in the clear, for as
        // long as the decode's buffer lives.
        let decoded = Zeroizing::new(URL_SAFE_NO_PAD.decode(key).map_err(|_| incomplete())?);
        if decoded.len() != KEY_LEN {
            return Err(incomplete());
        }
        let mut bytes = Zeroizing::new([0u8; KEY_LEN]);
        bytes.copy_from_slice(&decoded);

        Ok(Link {
            file_id: file_id.to_string(),
            key: ShareKey(bytes),
        })
    }
}

fn is_version_tag(s: &str) -> bool {
    matches!(s.strip_prefix('v'), Some(rest) if !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()))
}

// These reach the user verbatim, so they say what to do about it rather than
// what failed.
fn not_a_link() -> Error {
    Error::Other("this is not a Swifty share link".into())
}

fn incomplete() -> Error {
    Error::Other("this link is incomplete".into())
}

fn newer_version() -> Error {
    Error::Other("this link was made by a newer version of Swifty".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn entry() -> Entry {
        serde_json::from_value(json!({
            "id": "entry-1", "type": "login", "title": "Site",
            "website": "https://ex.com/login", "username": "alice",
            "password": "s3cret", "otp": "SEED",
            "tags": ["work", "eu"],
            "extra": [{"label": "PIN", "value": "1234"}],
            "favorite": true,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-02-01T00:00:00Z",
            "password_updated_at": "2024-02-01T00:00:00Z",
            "passkeys": [{
                "credentialId": "Y3JlZA", "rpId": "ex.com",
                "userHandle": "dXNlcg", "userName": "alice",
                "userDisplayName": "Alice", "privateKey": "cHJpdmF0ZUtleQ",
                "counter": 0
            }]
        }))
        .unwrap()
    }

    #[test]
    fn seal_round_trips_the_entry_without_the_sender_s_copy() {
        let key = ShareKey::generate();
        let blob = seal(&key, &entry()).unwrap();
        assert!(!blob.windows(6).any(|w| w == b"s3cret"));

        let back = unseal(&key, &blob).unwrap();
        assert_eq!(back.title, "Site");
        assert_eq!(back.password.as_deref(), Some("s3cret"));
        assert_eq!(back.otp.as_deref(), Some("SEED"));
        assert_eq!(back.username.as_deref(), Some("alice"));
        assert_eq!(
            back.tags.as_deref(),
            Some(&["work".into(), "eu".into()][..])
        );
        assert_eq!(back.extra.unwrap()[0].value, "1234");

        assert_eq!(back.id, "");
        assert!(back.created_at.is_none());
        assert!(back.updated_at.is_none());
        assert!(back.password_updated_at.is_none());
        assert!(!back.favorite);
        assert!(back.passkeys.is_none());
    }

    #[test]
    fn tampered_ciphertext_does_not_open() {
        let key = ShareKey::generate();
        let mut blob = seal(&key, &entry()).unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 1;
        assert_eq!(
            unseal(&key, &blob).unwrap_err().to_string(),
            "this link does not open the share"
        );
    }

    #[test]
    fn wrong_key_does_not_open() {
        let blob = seal(&ShareKey::generate(), &entry()).unwrap();
        assert!(unseal(&ShareKey::generate(), &blob).is_err());
    }

    #[test]
    fn a_newer_envelope_version_is_refused() {
        let key = ShareKey::generate();
        let plaintext =
            serde_json::to_vec(&json!({"v": 2, "entry": {"shape": "unknown"}})).unwrap();
        let blob = crate::crypto::seal_aead(key.as_ref(), &plaintext).unwrap();
        assert_eq!(
            unseal(&key, &blob).unwrap_err().to_string(),
            "this share was made by a newer version of Swifty"
        );
    }

    #[test]
    fn link_round_trips() {
        let original = Link {
            file_id: "1A-bC_dEfG".into(),
            key: ShareKey::generate(),
        };
        let parsed = Link::parse(&original.format()).unwrap();
        assert_eq!(parsed.file_id, original.file_id);
        assert_eq!(parsed.key.as_ref(), original.key.as_ref());
    }

    #[test]
    fn surrounding_whitespace_is_ignored() {
        let original = Link {
            file_id: "fileId".into(),
            key: ShareKey::generate(),
        };
        let pasted = format!("  {}\n", original.format());
        assert_eq!(Link::parse(&pasted).unwrap().file_id, "fileId");
    }

    #[test]
    fn parse_refuses_anything_that_is_not_a_link() {
        let key = URL_SAFE_NO_PAD.encode([7u8; KEY_LEN]);
        for input in [
            "https://example.com/share".to_string(),
            format!("swifty://open#v1.fileId.{key}"),
            format!("swifty://share#v1.file!d.{key}"),
            format!("swifty://share#v1.fileId.{key}.extra"),
        ] {
            assert_eq!(
                Link::parse(&input).unwrap_err().to_string(),
                "this is not a Swifty share link",
                "{input}"
            );
        }
    }

    #[test]
    fn parse_refuses_an_incomplete_link() {
        let key = URL_SAFE_NO_PAD.encode([7u8; KEY_LEN]);
        for input in [
            "swifty://share#v1.fileId".to_string(),
            format!("swifty://share#v1..{key}"),
            format!("swifty://share#v1.fileId.{}", &key[..20]),
            format!(
                "swifty://share#v1.fileId.{}",
                URL_SAFE_NO_PAD.encode([7u8; 64])
            ),
        ] {
            assert_eq!(
                Link::parse(&input).unwrap_err().to_string(),
                "this link is incomplete",
                "{input}"
            );
        }
    }

    #[test]
    fn parse_refuses_a_newer_link_version() {
        let key = URL_SAFE_NO_PAD.encode([7u8; KEY_LEN]);
        assert_eq!(
            Link::parse(&format!("swifty://share#v2.fileId.{key}"))
                .unwrap_err()
                .to_string(),
            "this link was made by a newer version of Swifty"
        );
    }

    #[test]
    fn expires_a_day_out() {
        assert_eq!(expires_at(1_000), 1_000 + 24 * 60 * 60 * 1000);
    }
}
