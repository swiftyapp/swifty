//! FIDO Alliance Credential Exchange Format 1.0 — the unencrypted document
//! (`{"version":{…},"accounts":[{"items":[…]}]}`). CXP's HPKE transport is out
//! of scope; this reads and writes the payload only.
//!
//! Spec: <https://fidoalliance.org/specs/cx/cxf-v1.0-ps-20250814.html>
//!
//! One CXF item carries a *list* of credentials, so the unit of mapping is the
//! item, not the credential: `basic-auth` + `passkey` + `totp` + `note` on the
//! same item is one login. Unknown credential types are ignored rather than
//! reported — the format is meant to grow. A row is the 1-based item index
//! counted across every account, which is the order they appear in the file.

use super::export::{FINGERPRINT_LABEL, PASSPHRASE_LABEL, PUBLIC_KEY_LABEL};
use super::{EntryKind, ImportResult, ImportedEntry, ImportedPasskey, Importer};
use serde::Deserialize;
use serde_json::Value;

pub struct Cxf;

#[derive(Deserialize)]
struct Document {
    #[serde(default)]
    accounts: Vec<Account>,
}

#[derive(Deserialize)]
struct Account {
    #[serde(default)]
    items: Vec<Item>,
}

#[derive(Deserialize)]
struct Item {
    #[serde(default)]
    title: Option<String>,
    #[serde(default, rename = "creationAt")]
    creation_at: Option<u64>,
    #[serde(default)]
    scope: Option<Scope>,
    /// Pre-1.0 drafts put the urls straight on the item instead of in `scope`.
    #[serde(default)]
    urls: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    credentials: Vec<Credential>,
}

#[derive(Deserialize)]
struct Scope {
    #[serde(default)]
    urls: Vec<String>,
}

/// Every credential type flattened into one shape, discriminated by `type`.
/// One struct rather than an enum because the types share member names
/// (`username`, `number`) and because a malformed member of one credential
/// must not fail the whole document — everything is optional and validated
/// where it is used.
#[derive(Deserialize)]
struct Credential {
    #[serde(rename = "type")]
    kind: String,
    // `basic-auth`, `passkey` and `totp` all spell the account name
    // `username`; only `basic-auth` wraps it in an EditableField.
    #[serde(default)]
    username: Option<Value>,
    #[serde(default)]
    password: Option<Value>,
    // passkey
    #[serde(default, rename = "credentialId")]
    credential_id: Option<String>,
    #[serde(default, rename = "rpId")]
    rp_id: Option<String>,
    #[serde(default, rename = "userDisplayName")]
    user_display_name: Option<String>,
    #[serde(default, rename = "userHandle")]
    user_handle: Option<String>,
    #[serde(default)]
    key: Option<String>,
    // totp
    #[serde(default)]
    secret: Option<String>,
    // credit-card
    #[serde(default)]
    number: Option<Value>,
    #[serde(default, rename = "fullName")]
    full_name: Option<Value>,
    #[serde(default, rename = "verificationNumber")]
    verification_number: Option<Value>,
    #[serde(default, rename = "expiryDate")]
    expiry_date: Option<Value>,
    // note
    #[serde(default)]
    content: Option<Value>,
    // ssh-key
    #[serde(default, rename = "privateKey")]
    private_key: Option<Value>,
    // custom-fields: a list of EditableFields with a `label` each
    #[serde(default)]
    fields: Vec<Value>,
}

impl Importer for Cxf {
    fn parse(&self, bytes: &[u8]) -> ImportResult {
        let mut result = ImportResult::default();
        let doc: Document = match serde_json::from_slice(bytes) {
            Ok(d) => d,
            Err(e) => {
                result.push_err(0, format!("invalid CXF JSON: {e}"));
                return result;
            }
        };
        for (i, item) in doc.accounts.into_iter().flat_map(|a| a.items).enumerate() {
            map_item(item, i + 1, &mut result);
        }
        result
    }
}

fn map_item(item: Item, row: usize, result: &mut ImportResult) {
    let Item {
        title,
        creation_at,
        scope,
        urls,
        tags,
        credentials,
    } = item;
    // `scope.urls` is where 1.0 keeps them; the loose `urls` is the old draft.
    let url = scope
        .into_iter()
        .flat_map(|s| s.urls)
        .chain(urls)
        .find(|u| !u.is_empty());
    // CXF dates the item, not the credential, so every passkey on it shares one.
    let created_at = creation_at.and_then(rfc3339);
    let title = title.unwrap_or_default();

    let mut basic: Option<Credential> = None;
    let mut card: Option<Credential> = None;
    let mut ssh: Option<Credential> = None;
    let mut custom: Vec<Value> = Vec::new();
    let mut passkeys: Vec<ImportedPasskey> = Vec::new();
    let mut otp: Option<String> = None;
    let mut note: Option<String> = None;
    for cred in credentials {
        match cred.kind.as_str() {
            "basic-auth" => basic = basic.or(Some(cred)),
            "credit-card" => card = card.or(Some(cred)),
            // The private key *is* the credential: an `ssh-key` without one has
            // nothing to restore and is left unmapped like any unknown type.
            "ssh-key" if text(&cred.private_key).is_some() => ssh = ssh.or(Some(cred)),
            // Only read for the labels the exporter writes beside an ssh-key;
            // anything else in there has no slot on an entry.
            "custom-fields" => custom.extend(cred.fields),
            "passkey" => match passkey(&cred, created_at.clone()) {
                Some(p) => passkeys.push(p),
                None => result.push_err(row, "incomplete passkey"),
            },
            // The app keeps a single base32 seed per entry, so the first wins.
            "totp" => otp = otp.or_else(|| non_empty(cred.secret)),
            "note" => note = note.or_else(|| Some(text(&cred.content).unwrap_or_default())),
            _ => {}
        }
    }
    let notes = note.clone().filter(|n| !n.is_empty());

    // A login is anything you can sign in with: a password, a passkey, or both.
    if basic.is_some() || !passkeys.is_empty() {
        let (username, password) = match &basic {
            Some(c) => (text(&c.username), text(&c.password)),
            None => (None, None),
        };
        result.entries.push(ImportedEntry {
            kind: EntryKind::Login,
            title,
            // A passkey-only item has no basic-auth to name it; the
            // credential's own `username` is the closest thing to one.
            username: username.or_else(|| {
                passkeys
                    .first()
                    .and_then(|p| non_empty(Some(p.user_name.clone())))
            }),
            password,
            url,
            notes,
            otp,
            tags,
            passkeys,
            ..Default::default()
        });
    } else if let Some(c) = ssh {
        result.entries.push(ImportedEntry {
            kind: EntryKind::Ssh,
            title,
            notes,
            tags,
            ssh_private_key: text(&c.private_key),
            ssh_public_key: custom_field(&custom, PUBLIC_KEY_LABEL),
            ssh_fingerprint: custom_field(&custom, FINGERPRINT_LABEL),
            ssh_passphrase: custom_field(&custom, PASSPHRASE_LABEL),
            ..Default::default()
        });
    } else if let Some(c) = card {
        let (month, year) = expiry(&c.expiry_date);
        result.entries.push(ImportedEntry {
            kind: EntryKind::Card,
            title,
            notes,
            tags,
            card_number: text(&c.number),
            card_month: month,
            card_year: year,
            card_cvc: text(&c.verification_number),
            cardholder: text(&c.full_name),
            ..Default::default()
        });
    } else if note.is_some() {
        result.entries.push(ImportedEntry {
            kind: EntryKind::Note,
            title,
            notes,
            tags,
            ..Default::default()
        });
    } else {
        result.push_err(row, "item has no supported credential");
    }
}

/// `credentialId`, `rpId` and `key` *are* the credential — without any one of
/// them there is nothing to sign with, so the passkey is skipped (its item
/// still imports). CXF carries no signature counter, so it starts at zero.
fn passkey(c: &Credential, created_at: Option<String>) -> Option<ImportedPasskey> {
    Some(ImportedPasskey {
        credential_id: non_empty(c.credential_id.clone())?,
        rp_id: non_empty(c.rp_id.clone())?,
        // CXF has no relying-party display name.
        rp_name: None,
        user_handle: c.user_handle.clone().unwrap_or_default(),
        user_name: text(&c.username).unwrap_or_default(),
        user_display_name: c.user_display_name.clone().unwrap_or_default(),
        private_key: non_empty(c.key.clone())?,
        counter: 0,
        created_at,
    })
}

/// The value of the custom field labelled `label` (case-insensitive), if any.
fn custom_field(fields: &[Value], label: &str) -> Option<String> {
    fields
        .iter()
        .find(|f| {
            f.get("label")
                .and_then(Value::as_str)
                .is_some_and(|l| l.eq_ignore_ascii_case(label))
        })
        .and_then(|f| non_empty(f.get("value")?.as_str().map(str::to_owned)))
}

/// A CXF value is an `EditableField` (`{"fieldType":…,"value":…}`); older
/// drafts wrote a bare string. Accept both, and treat anything else as absent
/// rather than failing the file.
fn text(v: &Option<Value>) -> Option<String> {
    match v.as_ref()? {
        Value::String(s) => non_empty(Some(s.clone())),
        Value::Object(o) => non_empty(o.get("value")?.as_str().map(str::to_owned)),
        _ => None,
    }
}

/// `expiryDate` is a `year-month` field: RFC 3339 `YYYY-MM`. Returns
/// (month, year), the order the app stores them in.
fn expiry(v: &Option<Value>) -> (Option<String>, Option<String>) {
    match text(v).and_then(|s| s.split_once('-').map(|(y, m)| (y.to_owned(), m.to_owned()))) {
        Some((year, month)) => (Some(month), Some(year)),
        None => (None, None),
    }
}

/// CXF timestamps are Unix seconds; the app stores RFC 3339 strings.
fn rfc3339(secs: u64) -> Option<String> {
    let secs = i64::try_from(secs).ok()?;
    chrono::DateTime::from_timestamp(secs, 0).map(|t| t.to_rfc3339())
}

// Treat empty strings as absent so blank export fields don't become "" secrets.
fn non_empty(s: Option<String>) -> Option<String> {
    s.filter(|v| !v.is_empty())
}
