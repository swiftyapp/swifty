use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// A vault entry. Kept as a single flat struct (rather than an enum) so it
// round-trips the untyped legacy object shape; `kind` discriminates login/note/card.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub otp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub month: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub year: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cvc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    /// WebAuthn passkeys stored on a login entry. `None` when the entry has
    /// none, so every pre-passkey vault JSON, `.swftx` backup and fixture
    /// serializes byte-identically to before.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passkeys: Option<Vec<Passkey>>,
    /// The user's star. Stored as a column rather than in the payload, so it
    /// rides along here only to survive a `.swftx` export/import round-trip —
    /// the editor never sends it, which is what keeps an ordinary save from
    /// clearing one (see `store::migrate::build_record`). Omitted when unset, so
    /// a backup of an unstarred vault stays byte-identical to the legacy format.
    #[serde(default, skip_serializing_if = "is_unset")]
    pub favorite: bool,
    #[serde(rename = "createdAt", default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(
        rename = "password_updated_at",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub password_updated_at: Option<String>,
}

fn is_unset(flag: &bool) -> bool {
    !*flag
}

/// A single WebAuthn credential held by a login entry. Only P-256 ECDSA is
/// supported, so there is no algorithm field. `credential_id`, `user_handle` and
/// `private_key` are base64url and are stored exactly as the source gave them —
/// never re-encoded, so a round-trip through import/export is byte-exact.
/// `private_key` is a secret and only ever lives inside the sealed payload.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Passkey {
    pub credential_id: String,
    pub rp_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rp_name: Option<String>,
    pub user_handle: String,
    pub user_name: String,
    pub user_display_name: String,
    /// PKCS#8 DER, base64url.
    pub private_key: String,
    #[serde(default)]
    pub counter: u32,
    /// RFC3339.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultData {
    pub entries: Vec<Entry>,
}

// Non-secret entry metadata sent to the frontend for the list. Never carries a
// secret field; secrets stay in the encrypted payload, revealed one at a time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryMetaDto {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub tags: Vec<String>,
    pub url_host: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card_brand: Option<String>,
    pub favorite: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    // Set only on the tombstones the Trash lists; absent for live entries.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
}

// The one projection of a stored metadata row onto the frontend DTO (timestamps
// are ms → RFC3339). Every command reads its row as an `EntryMeta` (`list`,
// `list_deleted`, `row_meta`), so save and list cannot drift apart on which
// columns reach the UI.
impl From<&crate::store::EntryMeta> for EntryMetaDto {
    fn from(m: &crate::store::EntryMeta) -> Self {
        Self {
            id: m.id.clone(),
            kind: m.kind.clone(),
            title: m.title.clone(),
            tags: serde_json::from_str(&m.tags).unwrap_or_default(),
            url_host: m.url_host.clone(),
            // "none" marks a completed derivation with no match — internal only.
            card_brand: m.card_brand.clone().filter(|b| b != "none"),
            favorite: m.favorite,
            created_at: iso(m.created_at),
            updated_at: iso(m.updated_at),
            deleted_at: m.deleted_at.and_then(iso),
        }
    }
}

fn iso(ms: i64) -> Option<String> {
    chrono::DateTime::from_timestamp_millis(ms).map(|d| d.to_rfc3339())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockResult {
    pub entries: Vec<EntryMetaDto>,
    pub sync_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratorOptions {
    pub length: u32,
    #[serde(default)]
    pub numbers: bool,
    #[serde(default)]
    pub symbols: bool,
    #[serde(default)]
    pub uppercase: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lowercase: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude_similar_characters: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtpResult {
    pub code: String,
    pub time: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditItem {
    pub score: u8,
    pub is_weak: bool,
    pub is_repeating: bool,
    pub breached: bool,
}

// Audit results keyed by entry id.
pub type Audit = HashMap<String, AuditItem>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub configured: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Pre-passkey JSON stays readable, and an entry without passkeys serializes
    // exactly as it did before the field existed.
    #[test]
    fn entry_without_passkeys_round_trips_without_the_key() {
        let json = r#"{"id":"1","type":"login","title":"Site","password":"pw"}"#;
        let entry: Entry = serde_json::from_str(json).unwrap();
        assert!(entry.passkeys.is_none());
        let out = serde_json::to_string(&entry).unwrap();
        assert!(!out.contains("passkeys"), "{out}");
    }

    #[test]
    fn passkey_serializes_camel_case_and_skips_absent_optionals() {
        let entry: Entry = serde_json::from_str(
            r#"{"id":"1","type":"login","title":"Site","passkeys":[
                 {"credentialId":"Y3JlZDE","rpId":"acme.test","userHandle":"dWgx",
                  "userName":"alice","userDisplayName":"Alice","privateKey":"cGsx"}]}"#,
        )
        .unwrap();
        let passkeys = entry.passkeys.clone().unwrap();
        assert_eq!(passkeys[0].credential_id, "Y3JlZDE");
        assert_eq!(passkeys[0].private_key, "cGsx");
        assert_eq!(passkeys[0].counter, 0);
        assert_eq!(passkeys[0].rp_name, None);

        let out = serde_json::to_value(&entry).unwrap();
        let p = &out["passkeys"][0];
        assert_eq!(p["userDisplayName"], "Alice");
        assert_eq!(p["counter"], 0);
        assert!(p.get("rpName").is_none());
        assert!(p.get("createdAt").is_none());
    }
}
