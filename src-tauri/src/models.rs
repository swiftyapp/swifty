use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// A vault entry. Kept as a single flat struct (rather than an enum) so it
// round-trips the untyped legacy object shape; `kind` discriminates
// login/note/card/identity.
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
    /// ID-document fields (`identity` entries). `doc_type` is one of `passport`,
    /// `id_card`, `driver_license`, `residence_permit`, `other`; the three dates
    /// are ISO `YYYY-MM-DD`. The document number and full name reuse `number` and
    /// `name`. All `None` on every other kind, so a pre-identity vault JSON,
    /// `.swftx` backup and fixture serializes byte-identically to before.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nationality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub birth_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sex: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issue_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub authority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub personal_number: Option<String>,
    /// SSH key fields (`ssh` entries). ed25519 only for now: `private_key` is an
    /// OpenSSH PEM block, `public_key` the single `ssh-ed25519 AAAA… comment`
    /// line and `fingerprint` its `SHA256:…` digest, derived once at save time so
    /// the detail view needs no key parsing. `passphrase` is what the user
    /// protected the key with elsewhere — we never encrypt the key ourselves.
    /// camelCase on the wire, matching the draft keys the editor writes.
    #[serde(
        rename = "privateKey",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub private_key: Option<String>,
    #[serde(rename = "publicKey", default, skip_serializing_if = "Option::is_none")]
    pub public_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    /// WebAuthn passkeys stored on a login entry. `None` when the entry has
    /// none, so every pre-passkey vault JSON, `.swftx` backup and fixture
    /// serializes byte-identically to before.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passkeys: Option<Vec<Passkey>>,
    /// Free-form label/value pairs, in the order the user put them in — what a
    /// document carries that the fixed rows have no room for ("Categories: B,
    /// BE"). Kind-agnostic: any entry may hold them. `None` when there are none,
    /// so every pre-extras vault JSON, `.swftx` backup and fixture serializes
    /// byte-identically to before. Not obscured per field: the payload is sealed
    /// as a whole, and per-field secrecy for extras is deferred.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extra: Option<Vec<ExtraField>>,
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

/// One free-form field on an entry: a label the user wrote and its value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExtraField {
    pub label: String,
    pub value: String,
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
    // Whether the entry holds a passkey. Derived metadata, so the list can mark
    // the row without revealing anything; the passkeys themselves stay sealed.
    pub has_passkey: bool,
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
            has_passkey: m.has_passkey,
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

/// A freshly generated ed25519 keypair, in the forms an entry stores them in:
/// the OpenSSH PEM private block, the single-line public key, and the
/// `SHA256:…` fingerprint. Keyed like the `ssh` draft, so the generator's
/// output can be handed straight to a new entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyPair {
    pub private_key: String,
    pub public_key: String,
    pub fingerprint: String,
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
    /// A consent flow is out with the browser. Owned here, not by the frontend:
    /// the backend is what starts and ends it, so it is the one that can say.
    pub pending: bool,
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

    // The identity fields are snake_case on the wire (the scanner and the
    // frontend draft both key off these exact names), and absent when unset.
    #[test]
    fn identity_fields_round_trip_snake_case_and_stay_absent_when_unset() {
        let entry: Entry = serde_json::from_str(
            r#"{"id":"1","type":"identity","title":"Passport","name":"ADA LOVELACE",
                 "number":"X1234567","doc_type":"passport","country":"GBR",
                 "birth_date":"1815-12-10","personal_number":"99-1815"}"#,
        )
        .unwrap();
        assert_eq!(entry.doc_type.as_deref(), Some("passport"));
        assert_eq!(entry.birth_date.as_deref(), Some("1815-12-10"));
        assert_eq!(entry.personal_number.as_deref(), Some("99-1815"));

        let out = serde_json::to_value(&entry).unwrap();
        assert_eq!(out["doc_type"], "passport");
        assert_eq!(out["birth_date"], "1815-12-10");
        assert!(out.get("issue_date").is_none());
        assert!(out.get("nationality").is_none());
    }

    // A login has no identity fields, so its JSON is exactly what it always was.
    #[test]
    fn non_identity_entry_serializes_without_the_identity_keys() {
        let entry: Entry =
            serde_json::from_str(r#"{"id":"1","type":"login","title":"Site","password":"pw"}"#)
                .unwrap();
        let out = serde_json::to_string(&entry).unwrap();
        assert_eq!(
            out,
            r#"{"id":"1","type":"login","title":"Site","password":"pw"}"#
        );
    }

    // Extras are ordered and kind-agnostic, and an entry without them carries
    // no `extra` key at all — the whole point of the `Option`.
    #[test]
    fn extra_fields_round_trip_in_order_and_stay_absent_when_unset() {
        let entry: Entry = serde_json::from_str(
            r#"{"id":"1","type":"identity","title":"Licence","extra":[
                 {"label":"Categories","value":"B, BE"},
                 {"label":"Blood type","value":"O+"}]}"#,
        )
        .unwrap();
        let extra = entry.extra.clone().unwrap();
        assert_eq!(extra[0].label, "Categories");
        assert_eq!(extra[1].value, "O+");

        let out = serde_json::to_value(&entry).unwrap();
        assert_eq!(out["extra"][0]["label"], "Categories");
        assert_eq!(out["extra"][1]["label"], "Blood type");

        let bare: Entry =
            serde_json::from_str(r#"{"id":"1","type":"note","title":"Wifi"}"#).unwrap();
        assert!(bare.extra.is_none());
        let out = serde_json::to_string(&bare).unwrap();
        assert!(!out.contains("extra"), "{out}");
    }

    fn meta(has_passkey: bool) -> crate::store::EntryMeta {
        crate::store::EntryMeta {
            id: "1".into(),
            kind: "login".into(),
            title: "Site".into(),
            tags: "[]".into(),
            url_host: "acme.test".into(),
            created_at: 0,
            updated_at: 0,
            deleted_at: None,
            card_brand: None,
            favorite: false,
            has_passkey,
        }
    }

    // The list needs to know a row has a passkey without revealing one, so the
    // flag has to reach the UI as `hasPasskey` — and never the passkeys.
    #[test]
    fn meta_dto_carries_the_passkey_flag() {
        let flagged = serde_json::to_value(EntryMetaDto::from(&meta(true))).unwrap();
        assert_eq!(flagged["hasPasskey"], true);
        assert!(flagged.get("passkeys").is_none());

        let plain = serde_json::to_value(EntryMetaDto::from(&meta(false))).unwrap();
        assert_eq!(plain["hasPasskey"], false);
    }
}
