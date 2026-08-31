//! Bitwarden unencrypted JSON export (`{"items":[...]}`). Item `type` is 1=login,
//! 2=secure note, 3=card, 4=identity. We map 1/2/3; anything else is a row error.

use serde::Deserialize;

use super::{EntryKind, ImportResult, ImportedEntry, Importer};

pub struct Bitwarden;

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
            match item.kind {
                1 => {
                    let login = item.login.unwrap_or(Login {
                        username: None,
                        password: None,
                        totp: None,
                        uris: vec![],
                    });
                    result.entries.push(ImportedEntry {
                        kind: EntryKind::Login,
                        title,
                        username: opt(login.username),
                        password: opt(login.password),
                        url: login.uris.into_iter().find_map(|u| opt(u.uri)),
                        notes: opt(item.notes),
                        otp: opt(login.totp),
                        ..Default::default()
                    });
                }
                2 => result.entries.push(ImportedEntry {
                    kind: EntryKind::Note,
                    title,
                    notes: opt(item.notes),
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
