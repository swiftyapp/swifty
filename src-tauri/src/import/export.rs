//! Serialize normalized entries out to a file. Three formats: Bitwarden-compatible
//! JSON (re-importable here and by Bitwarden), a FIDO Credential Exchange Format
//! document, and a generic CSV. CSV cells are sanitized against spreadsheet
//! formula injection.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde::Serialize;
use serde_json::{json, Value};

use super::bitwarden::{FIELD_HIDDEN, FIELD_TEXT, KEY_ALGORITHM, KEY_CURVE, KEY_TYPE};
use super::{EntryKind, ImportedEntry, ImportedPasskey};
use crate::app::APP_NAME;

/// The exporter's relying-party id in a CXF document: the project's domain.
pub const EXPORTER_RP_ID: &str = "getswifty.pro";

/// Bitwarden `type` codes.
fn bw_type(kind: EntryKind) -> u8 {
    match kind {
        EntryKind::Login => 1,
        EntryKind::Note => 2,
        EntryKind::Card => 3,
        EntryKind::Identity => 4,
        EntryKind::Ssh => 5,
    }
}

/// The label under which the passphrase travels where a format has no member
/// for it: a hidden custom field in Bitwarden, a custom-fields credential in
/// CXF. The importers look for the same label, case-insensitively.
pub const PASSPHRASE_LABEL: &str = "Passphrase";
/// CXF has no members for the public line and fingerprint, so they ride in the
/// same custom-fields credential under these labels.
pub const PUBLIC_KEY_LABEL: &str = "Public key";
pub const FINGERPRINT_LABEL: &str = "Fingerprint";

/// Serialize to Bitwarden's unencrypted JSON export shape.
pub fn to_bitwarden_json(entries: &[ImportedEntry]) -> serde_json::Result<Vec<u8>> {
    let items: Vec<_> = entries
        .iter()
        .map(|e| {
            let mut item = json!({
                "type": bw_type(e.kind),
                "name": e.title,
                "notes": e.notes,
            });
            // Extras go in Bitwarden's own custom fields, for every kind — and
            // only when there are some, so an export of a vault without any is
            // byte-identical to before.
            if !e.extra.is_empty() {
                item["fields"] = json!(e
                    .extra
                    .iter()
                    .map(|(label, value)| json!({
                        "name": label,
                        "value": value,
                        "type": FIELD_TEXT,
                    }))
                    .collect::<Vec<_>>());
            }
            match e.kind {
                EntryKind::Login => {
                    item["login"] = json!({
                        "username": e.username,
                        "password": e.password,
                        "totp": e.otp,
                        "uris": e.url.as_ref().map(|u| vec![json!({ "uri": u })]).unwrap_or_default(),
                    });
                    // Only written when there is something to write, so an
                    // export of a passkey-less vault is unchanged.
                    if !e.passkeys.is_empty() {
                        item["login"]["fido2Credentials"] =
                            json!(e.passkeys.iter().map(fido2_credential).collect::<Vec<_>>());
                    }
                }
                EntryKind::Card => {
                    item["card"] = json!({
                        "cardholderName": e.cardholder,
                        "number": e.card_number,
                        "expMonth": e.card_month,
                        "expYear": e.card_year,
                        "code": e.card_cvc,
                    });
                }
                EntryKind::Identity => {
                    let (first, last) = split_name(e.holder_name.as_deref());
                    let mut identity = json!({
                        "firstName": first,
                        "lastName": last,
                        "country": e.doc_country,
                    });
                    // Bitwarden holds exactly two document numbers, so the
                    // document's own type picks which slot this one goes in.
                    identity[license_slot(e)] = json!(e.doc_number);
                    item["identity"] = identity;
                }
                EntryKind::Ssh => {
                    item["sshKey"] = json!({
                        "privateKey": e.ssh_private_key,
                        "publicKey": e.ssh_public_key,
                        "keyFingerprint": e.ssh_fingerprint,
                    });
                    // Bitwarden's SSH item has no passphrase member, so it goes
                    // in a hidden custom field rather than nowhere.
                    if let Some(passphrase) = &e.ssh_passphrase {
                        let field = json!({
                            "name": PASSPHRASE_LABEL,
                            "value": passphrase,
                            "type": FIELD_HIDDEN,
                        });
                        match item["fields"].as_array_mut() {
                            Some(fields) => fields.push(field),
                            None => item["fields"] = json!([field]),
                        }
                    }
                }
                EntryKind::Note => {}
            }
            item
        })
        .collect();

    #[derive(Serialize)]
    struct Export {
        encrypted: bool,
        folders: Vec<()>,
        items: Vec<serde_json::Value>,
    }
    serde_json::to_vec_pretty(&Export {
        encrypted: false,
        folders: vec![],
        items,
    })
}

/// Which of Bitwarden's two document-number members carries this document.
fn license_slot(e: &ImportedEntry) -> &'static str {
    if e.doc_type.as_deref() == Some("driver_license") {
        "licenseNumber"
    } else {
        "passportNumber"
    }
}

/// A full name split into Bitwarden's first/last pair: first word against the
/// rest. Lossy by nature — "ADA KING LOVELACE" cannot say which part is which —
/// so the app keeps the whole name and only the export is split.
fn split_name(name: Option<&str>) -> (Option<String>, Option<String>) {
    let Some(name) = name.map(str::trim).filter(|n| !n.is_empty()) else {
        return (None, None);
    };
    match name.split_once(char::is_whitespace) {
        Some((first, rest)) => (
            Some(first.to_owned()),
            Some(rest.trim_start().to_owned()).filter(|r| !r.is_empty()),
        ),
        None => (Some(name.to_owned()), None),
    }
}

/// One Bitwarden `fido2Credentials` element. Every value is a string there,
/// `counter` included; the key material is passed through verbatim.
fn fido2_credential(p: &ImportedPasskey) -> serde_json::Value {
    json!({
        "credentialId": p.credential_id,
        "keyType": KEY_TYPE,
        "keyAlgorithm": KEY_ALGORITHM,
        "keyCurve": KEY_CURVE,
        "keyValue": p.private_key,
        "rpId": p.rp_id,
        "rpName": p.rp_name,
        "userHandle": p.user_handle,
        "userName": p.user_name,
        "userDisplayName": p.user_display_name,
        "counter": p.counter.to_string(),
        "discoverable": "true",
        "creationDate": p.created_at,
    })
}

/// Serialize to a FIDO Credential Exchange Format 1.0 document — the inverse of
/// [`super::cxf`]. One account holding one item per entry; each value the app
/// has becomes a credential on that item. Optional members are omitted rather
/// than written empty, as the format asks.
///
/// Spec: <https://fidoalliance.org/specs/cx/cxf-v1.0-ps-20250814.html>
pub fn to_cxf_json(entries: &[ImportedEntry]) -> serde_json::Result<Vec<u8>> {
    let items: Vec<Value> = entries.iter().map(cxf_item).collect();
    serde_json::to_vec_pretty(&json!({
        "version": { "major": 1, "minor": 0 },
        // An RP id is a domain, so the exporter is identified by the project's
        // site rather than by the app name.
        "exporterRpId": EXPORTER_RP_ID,
        "exporterDisplayName": APP_NAME,
        "timestamp": now_secs(),
        "accounts": [{
            "id": random_id(),
            "username": "",
            "email": "",
            "collections": [],
            "items": items,
        }],
    }))
}

/// One CXF `Item`. An entry maps to a single item carrying every credential it
/// has: a login is basic-auth plus a passkey each, plus TOTP and a note when
/// set; notes ride along on cards too, since CXF has nowhere else to put them.
fn cxf_item(e: &ImportedEntry) -> Value {
    let now = now_secs();
    let mut credentials: Vec<Value> = Vec::new();
    match e.kind {
        EntryKind::Login => {
            let mut basic = json!({ "type": "basic-auth" });
            put(&mut basic, "username", editable("string", &e.username));
            put(
                &mut basic,
                "password",
                editable("concealed-string", &e.password),
            );
            credentials.push(basic);
            credentials.extend(e.passkeys.iter().map(cxf_passkey));
            if let Some(secret) = &e.otp {
                // The app stores a bare base32 seed and generates with the
                // WebAuthn/TOTP defaults, which are what these three are.
                credentials.push(json!({
                    "type": "totp",
                    "secret": secret,
                    "period": 30,
                    "digits": 6,
                    "algorithm": "sha1",
                }));
            }
        }
        EntryKind::Card => {
            let mut card = json!({ "type": "credit-card" });
            put(
                &mut card,
                "number",
                editable("concealed-string", &e.card_number),
            );
            put(&mut card, "fullName", editable("string", &e.cardholder));
            put(
                &mut card,
                "verificationNumber",
                editable("concealed-string", &e.card_cvc),
            );
            put(
                &mut card,
                "expiryDate",
                editable("year-month", &expiry_date(e)),
            );
            credentials.push(card);
        }
        EntryKind::Ssh => {
            // The private key is written as the app holds it (OpenSSH PEM),
            // which is what `ssh` itself reads. The parts CXF's `ssh-key` has
            // no member for travel in a custom-fields credential beside it.
            let mut key = json!({ "type": "ssh-key", "keyType": ssh_key_type(e) });
            put(
                &mut key,
                "privateKey",
                editable("concealed-string", &e.ssh_private_key),
            );
            put(&mut key, "keyComment", editable("string", &ssh_comment(e)));
            credentials.push(key);

            let fields: Vec<Value> = [
                (PUBLIC_KEY_LABEL, "string", &e.ssh_public_key),
                (FINGERPRINT_LABEL, "string", &e.ssh_fingerprint),
                (PASSPHRASE_LABEL, "concealed-string", &e.ssh_passphrase),
            ]
            .into_iter()
            .filter_map(|(label, field_type, value)| {
                value
                    .as_deref()
                    .map(|v| json!({ "fieldType": field_type, "label": label, "value": v }))
            })
            .collect();
            if !fields.is_empty() {
                credentials.push(json!({
                    "type": "custom-fields",
                    "id": random_id(),
                    "label": "SSH key",
                    "fields": fields,
                }));
            }
        }
        // CXF has purpose-built `passport`/`drivers-license`/`identity-document`
        // credentials, but nothing that covers all five document types the app
        // holds; until they are mapped one by one, an identity exports as its
        // title and note like a secure note does.
        EntryKind::Identity | EntryKind::Note => {}
    }
    if let Some(notes) = &e.notes {
        credentials.push(json!({ "type": "note", "content": editable_value("string", notes) }));
    }

    let mut item = json!({
        "id": random_id(),
        "creationAt": now,
        "modifiedAt": now,
        "title": e.title,
        "credentials": credentials,
    });
    put(
        &mut item,
        "scope",
        e.url
            .as_ref()
            .map(|u| json!({ "urls": [u], "androidApps": [] })),
    );
    put(
        &mut item,
        "tags",
        (!e.tags.is_empty()).then(|| json!(e.tags)),
    );
    item
}

/// One CXF `passkey` credential. `fido2Extensions` is optional and the app
/// keeps none, so it is left out; the counter has nowhere to go in CXF.
fn cxf_passkey(p: &ImportedPasskey) -> Value {
    json!({
        "type": "passkey",
        "credentialId": p.credential_id,
        "rpId": p.rp_id,
        "username": p.user_name,
        "userDisplayName": p.user_display_name,
        "userHandle": p.user_handle,
        "key": p.private_key,
    })
}

/// CXF's `keyType` is the OpenSSH algorithm name — the first token of the
/// public line. The app only generates ed25519, so that is the fallback for a
/// pasted key whose public line was never filled in.
fn ssh_key_type(e: &ImportedEntry) -> &str {
    e.ssh_public_key
        .as_deref()
        .and_then(|line| line.split_whitespace().next())
        .unwrap_or("ssh-ed25519")
}

/// The public line's trailing comment (`ssh-ed25519 AAAA… alice@laptop`), when
/// there is one.
fn ssh_comment(e: &ImportedEntry) -> Option<String> {
    let mut parts = e.ssh_public_key.as_deref()?.splitn(3, ' ');
    let (_, _, comment) = (parts.next()?, parts.next()?, parts.next()?);
    let comment = comment.trim();
    (!comment.is_empty()).then(|| comment.to_owned())
}

/// CXF wants `YYYY-MM`; the app stores month and year loose (`1`, `01`, `30`,
/// `2030`), so both are normalized. A card missing either has no expiry date.
fn expiry_date(e: &ImportedEntry) -> Option<String> {
    let (month, year) = (e.card_month.as_deref()?, e.card_year.as_deref()?);
    let year = if year.len() == 2 {
        format!("20{year}")
    } else {
        year.to_owned()
    };
    Some(format!("{year}-{month:0>2}"))
}

/// A CXF `EditableField` — the wrapper every user-visible value sits in.
fn editable_value(field_type: &str, value: &str) -> Value {
    json!({ "fieldType": field_type, "value": value })
}

fn editable(field_type: &str, value: &Option<String>) -> Option<Value> {
    value.as_deref().map(|v| editable_value(field_type, v))
}

/// Set `key` only when there is something to set: CXF's optional members are
/// absent, never present-and-empty.
fn put(object: &mut Value, key: &str, value: Option<Value>) {
    if let Some(value) = value {
        object[key] = value;
    }
}

fn now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

/// CXF ids are `b64url`. Sixteen random bytes, the same width as the app's own
/// entry ids (`commands::import::new_id`), in the encoding the format asks for.
fn random_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

const COLUMNS: &[&str] = &[
    "type",
    "title",
    "username",
    "password",
    "url",
    "notes",
    "otp",
    "card_number",
    "card_month",
    "card_year",
    "card_cvc",
    "cardholder",
    "doc_type",
    "doc_number",
    "doc_country",
    "holder_name",
    "ssh_private_key",
    "ssh_public_key",
    "ssh_fingerprint",
    "ssh_passphrase",
    "tags",
];

/// Serialize to a generic CSV. Every cell is passed through [`sanitize_cell`].
pub fn to_generic_csv(entries: &[ImportedEntry]) -> csv::Result<Vec<u8>> {
    let mut wtr = csv::Writer::from_writer(vec![]);
    wtr.write_record(COLUMNS)?;
    for e in entries {
        let row = [
            e.kind.as_str().to_string(),
            e.title.clone(),
            e.username.clone().unwrap_or_default(),
            e.password.clone().unwrap_or_default(),
            e.url.clone().unwrap_or_default(),
            e.notes.clone().unwrap_or_default(),
            e.otp.clone().unwrap_or_default(),
            e.card_number.clone().unwrap_or_default(),
            e.card_month.clone().unwrap_or_default(),
            e.card_year.clone().unwrap_or_default(),
            e.card_cvc.clone().unwrap_or_default(),
            e.cardholder.clone().unwrap_or_default(),
            e.doc_type.clone().unwrap_or_default(),
            e.doc_number.clone().unwrap_or_default(),
            e.doc_country.clone().unwrap_or_default(),
            e.holder_name.clone().unwrap_or_default(),
            e.ssh_private_key.clone().unwrap_or_default(),
            e.ssh_public_key.clone().unwrap_or_default(),
            e.ssh_fingerprint.clone().unwrap_or_default(),
            e.ssh_passphrase.clone().unwrap_or_default(),
            e.tags.join(";"),
        ];
        wtr.write_record(row.iter().map(|c| sanitize_cell(c)))?;
    }
    wtr.flush()?;
    wtr.into_inner()
        .map_err(|e| csv::Error::from(std::io::Error::other(e.to_string())))
}

/// Neutralize spreadsheet formula injection: a cell whose first character can
/// start a formula (`= + - @`) or a leading tab/CR is prefixed with a single
/// quote so a spreadsheet treats it as text. See OWASP "CSV Injection".
pub fn sanitize_cell(cell: &str) -> String {
    match cell.chars().next() {
        Some('=') | Some('+') | Some('-') | Some('@') | Some('\t') | Some('\r') => {
            format!("'{cell}")
        }
        _ => cell.to_string(),
    }
}
