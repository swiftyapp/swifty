//! Serialize normalized entries out to a file. Two formats: Bitwarden-compatible
//! JSON (re-importable here and by Bitwarden) and a generic CSV. CSV cells are
//! sanitized against spreadsheet formula injection.

use serde::Serialize;
use serde_json::json;

use super::bitwarden::{KEY_ALGORITHM, KEY_CURVE, KEY_TYPE};
use super::{EntryKind, ImportedEntry, ImportedPasskey};

/// Bitwarden `type` codes.
fn bw_type(kind: EntryKind) -> u8 {
    match kind {
        EntryKind::Login => 1,
        EntryKind::Note => 2,
        EntryKind::Card => 3,
    }
}

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
