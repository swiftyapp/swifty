//! Bitwarden unencrypted JSON export (`{"items":[...]}`). Item `type` is 1=login,
//! 2=secure note, 3=card, 4=identity. We map 1/2/3/4; anything else is a row error.

use serde::Deserialize;

use super::{EntryKind, ImportResult, ImportedEntry, ImportedPasskey, Importer};

pub struct Bitwarden;

/// The only passkey shape we support, on the way in and on the way out.
pub const KEY_TYPE: &str = "public-key";
pub const KEY_ALGORITHM: &str = "ECDSA";
pub const KEY_CURVE: &str = "P-256";

#[derive(Deserialize)]
struct Export {
    #[serde(default)]
    items: Vec<Item>,
}

#[derive(Deserialize)]
struct Item {
    #[serde(rename = "type")]
    kind: u8,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    login: Option<Login>,
    #[serde(default)]
    card: Option<Card>,
    #[serde(default)]
    identity: Option<Identity>,
    #[serde(default)]
    fields: Vec<Field>,
}

/// A Bitwarden custom field. `type` is 0 = text, 1 = hidden, 2 = boolean,
/// 3 = linked; the first two are values a person typed and become extra fields,
/// the other two are Bitwarden's own machinery and are dropped. An absent type
/// reads as text, which is what an unset one means there.
#[derive(Deserialize)]
struct Field {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    value: Option<String>,
    #[serde(default, rename = "type")]
    kind: u8,
}

pub const FIELD_TEXT: u8 = 0;
pub const FIELD_HIDDEN: u8 = 1;

// A row with neither a name nor a value says nothing, so it is not carried.
fn extras(fields: Vec<Field>) -> Vec<(String, String)> {
    fields
        .into_iter()
        .filter(|f| matches!(f.kind, FIELD_TEXT | FIELD_HIDDEN))
        .map(|f| (f.name.unwrap_or_default(), f.value.unwrap_or_default()))
        .filter(|(name, value)| !name.is_empty() || !value.is_empty())
        .collect()
}

#[derive(Deserialize)]
struct Login {
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    password: Option<String>,
    #[serde(default)]
    totp: Option<String>,
    #[serde(default)]
    uris: Vec<Uri>,
    #[serde(default, rename = "fido2Credentials")]
    fido2_credentials: Vec<Fido2Credential>,
}

// Every value in a Bitwarden fido2Credentials element is a JSON string,
// `counter` included — but a number is accepted too, so one odd producer
// cannot fail the whole file.
#[derive(Deserialize)]
struct Fido2Credential {
    #[serde(default, rename = "credentialId")]
    credential_id: Option<String>,
    #[serde(default, rename = "keyAlgorithm")]
    key_algorithm: Option<String>,
    #[serde(default, rename = "keyCurve")]
    key_curve: Option<String>,
    #[serde(default, rename = "keyValue")]
    key_value: Option<String>,
    #[serde(default, rename = "rpId")]
    rp_id: Option<String>,
    #[serde(default, rename = "rpName")]
    rp_name: Option<String>,
    #[serde(default, rename = "userHandle")]
    user_handle: Option<String>,
    #[serde(default, rename = "userName")]
    user_name: Option<String>,
    #[serde(default, rename = "userDisplayName")]
    user_display_name: Option<String>,
    #[serde(default)]
    counter: Option<serde_json::Value>,
    #[serde(default, rename = "creationDate")]
    creation_date: Option<String>,
}

impl Fido2Credential {
    // Absent algorithm/curve means "the default", which is the only one we
    // support; a stated one that differs is a credential we cannot use. Nor is
    // one missing its id, relying party or key — there is nothing to sign with.
    fn is_usable(&self) -> bool {
        let ok = |v: &Option<String>, want: &str| match v.as_deref() {
            Some(v) => v == want,
            None => true,
        };
        let present = |v: &Option<String>| v.as_deref().is_some_and(|s| !s.is_empty());
        ok(&self.key_algorithm, KEY_ALGORITHM)
            && ok(&self.key_curve, KEY_CURVE)
            && present(&self.credential_id)
            && present(&self.rp_id)
            && present(&self.key_value)
    }

    // A missing or non-numeric counter starts the credential at zero rather
    // than failing the import.
    fn counter(&self) -> u32 {
        match &self.counter {
            Some(serde_json::Value::String(s)) => s.parse().unwrap_or(0),
            Some(serde_json::Value::Number(n)) => {
                n.as_u64().and_then(|n| n.try_into().ok()).unwrap_or(0)
            }
            _ => 0,
        }
    }
}

impl From<Fido2Credential> for ImportedPasskey {
    fn from(c: Fido2Credential) -> Self {
        let counter = c.counter();
        ImportedPasskey {
            credential_id: c.credential_id.unwrap_or_default(),
            rp_id: c.rp_id.unwrap_or_default(),
            rp_name: opt(c.rp_name),
            user_handle: c.user_handle.unwrap_or_default(),
            user_name: c.user_name.unwrap_or_default(),
            user_display_name: c.user_display_name.unwrap_or_default(),
            private_key: c.key_value.unwrap_or_default(),
            counter,
            created_at: opt(c.creation_date),
        }
    }
}

#[derive(Deserialize)]
struct Uri {
    #[serde(default)]
    uri: Option<String>,
}

#[derive(Deserialize)]
struct Card {
    #[serde(default, rename = "cardholderName")]
    cardholder_name: Option<String>,
    #[serde(default)]
    number: Option<String>,
    #[serde(default, rename = "expMonth")]
    exp_month: Option<String>,
    #[serde(default, rename = "expYear")]
    exp_year: Option<String>,
    #[serde(default)]
    code: Option<String>,
}

// Bitwarden's identity item is a whole address book; only the four members the
// app has somewhere to put are read. Two document numbers, so which one is set
// is also what says whether this is a licence or a passport.
#[derive(Default, Deserialize)]
struct Identity {
    #[serde(default, rename = "firstName")]
    first_name: Option<String>,
    #[serde(default, rename = "middleName")]
    middle_name: Option<String>,
    #[serde(default, rename = "lastName")]
    last_name: Option<String>,
    #[serde(default)]
    country: Option<String>,
    #[serde(default, rename = "passportNumber")]
    passport_number: Option<String>,
    #[serde(default, rename = "licenseNumber")]
    license_number: Option<String>,
}

impl Identity {
    // The app keeps one full name, so the three parts are joined back up in
    // reading order — the inverse of the split the exporter does.
    fn full_name(&self) -> Option<String> {
        let parts: Vec<&str> = [&self.first_name, &self.middle_name, &self.last_name]
            .iter()
            .filter_map(|p| p.as_deref())
            .map(str::trim)
            .filter(|p| !p.is_empty())
            .collect();
        (!parts.is_empty()).then(|| parts.join(" "))
    }
}

impl Importer for Bitwarden {
    fn parse(&self, bytes: &[u8]) -> ImportResult {
        let mut result = ImportResult::default();
        let export: Export = match serde_json::from_slice(bytes) {
            Ok(e) => e,
            Err(e) => {
                result.push_err(0, format!("invalid Bitwarden JSON: {e}"));
                return result;
            }
        };

        for (i, item) in export.items.into_iter().enumerate() {
            let row = i + 1;
            let title = item.name.clone().unwrap_or_default();
            // Custom fields are not a kind's business: every item type may
            // carry them, so they are read once, before the kind is decided.
            let extra = extras(item.fields);
            match item.kind {
                1 => {
                    let login = item.login.unwrap_or(Login {
                        username: None,
                        password: None,
                        totp: None,
                        uris: vec![],
                        fido2_credentials: vec![],
                    });
                    // An unusable credential is dropped on its own — the login
                    // and its other passkeys still import.
                    let mut passkeys = Vec::new();
                    for cred in login.fido2_credentials {
                        if cred.is_usable() {
                            passkeys.push(cred.into());
                        } else {
                            result.push_err(row, "unsupported or incomplete passkey");
                        }
                    }
                    result.entries.push(ImportedEntry {
                        kind: EntryKind::Login,
                        title,
                        username: opt(login.username),
                        password: opt(login.password),
                        url: login.uris.into_iter().find_map(|u| opt(u.uri)),
                        notes: opt(item.notes),
                        otp: opt(login.totp),
                        passkeys,
                        extra,
                        ..Default::default()
                    });
                }
                2 => result.entries.push(ImportedEntry {
                    kind: EntryKind::Note,
                    title,
                    notes: opt(item.notes),
                    extra,
                    ..Default::default()
                }),
                3 => {
                    let card = item.card.unwrap_or(Card {
                        cardholder_name: None,
                        number: None,
                        exp_month: None,
                        exp_year: None,
                        code: None,
                    });
                    result.entries.push(ImportedEntry {
                        kind: EntryKind::Card,
                        title,
                        notes: opt(item.notes),
                        card_number: opt(card.number),
                        card_month: opt(card.exp_month),
                        card_year: opt(card.exp_year),
                        card_cvc: opt(card.code),
                        cardholder: opt(card.cardholder_name),
                        extra,
                        ..Default::default()
                    });
                }
                4 => {
                    let identity = item.identity.unwrap_or_default();
                    // A licence number says "driver_license"; anything else —
                    // including an item with neither number — is a passport,
                    // which is what Bitwarden's own field is named after.
                    let licence = opt(identity.license_number.clone());
                    let doc_type = if licence.is_some() {
                        "driver_license"
                    } else {
                        "passport"
                    };
                    result.entries.push(ImportedEntry {
                        kind: EntryKind::Identity,
                        title,
                        notes: opt(item.notes),
                        doc_type: Some(doc_type.to_owned()),
                        doc_number: licence.or_else(|| opt(identity.passport_number.clone())),
                        doc_country: opt(identity.country.clone()),
                        holder_name: identity.full_name(),
                        extra,
                        ..Default::default()
                    });
                }
                other => result.push_err(row, format!("unsupported item type {other}")),
            }
        }
        result
    }
}

// Treat empty strings as absent so blank export fields don't become "" secrets.
fn opt(s: Option<String>) -> Option<String> {
    s.filter(|v| !v.is_empty())
}
