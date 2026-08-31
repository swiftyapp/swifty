use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::models::{Audit, AuditItem, Entry};
use crate::state::AppState;
use chrono::{DateTime, Utc};
use tauri::State;

const MIN_LENGTH: usize = 8;
const FRESHNESS_DAYS: i64 = 90;

// Audit every password in the unlocked vault (weak / short / old / repeating).
// Passwords are stored encrypted, so decryption runs off the UI thread.
#[tauri::command]
pub async fn get_audit(state: State<'_, AppState>) -> Result<Audit> {
    let (cryptor, vault) = {
        let s = state.session.lock().unwrap();
        (s.cryptor()?, s.vault.clone().ok_or(Error::Locked)?)
    };
    tauri::async_runtime::spawn_blocking(move || audit(&cryptor, &vault.entries))
        .await
        .map_err(|e| Error::Crypto(e.to_string()))?
}

// Decrypt each non-empty password once, then flag weak / short / old / repeating.
fn audit(cryptor: &Cryptor, entries: &[Entry]) -> Result<Audit> {
    let creds: Vec<(&Entry, String)> = entries
        .iter()
        .filter_map(|e| e.password.as_deref().filter(|p| !p.is_empty()).map(|p| (e, p)))
        .map(|(e, p)| Ok((e, cryptor.decrypt(p)?)))
        .collect::<Result<_>>()?;

    let passwords: Vec<&str> = creds.iter().map(|(_, p)| p.as_str()).collect();
    Ok(creds
        .iter()
        .map(|(e, p)| {
            let repeating = passwords.iter().filter(|&&x| x == p).count() > 1;
            (
                e.id.clone(),
                AuditItem {
                    is_short: p.chars().count() < MIN_LENGTH,
                    is_weak: is_weak(p),
                    is_old: is_old(e),
                    is_repeating: repeating,
                },
            )
        })
        .collect())
}

// Weak if it lacks any of: uppercase, lowercase, digit, symbol.
fn is_weak(pw: &str) -> bool {
    let has_upper = pw.chars().any(|c| c.is_uppercase());
    let has_lower = pw.chars().any(|c| c.is_lowercase());
    let has_digit = pw.chars().any(|c| c.is_ascii_digit());
    let has_symbol = pw.chars().any(|c| !c.is_alphanumeric() && !c.is_whitespace());
    !(has_upper && has_lower && has_digit && has_symbol)
}

// Old if the last password update was over FRESHNESS_DAYS ago. Missing or
// unparseable timestamps are treated as not old (legacy luxon NaN behavior).
fn is_old(entry: &Entry) -> bool {
    let ts = entry
        .password_updated_at
        .as_deref()
        .or(entry.updated_at.as_deref());
    let Some(ts) = ts else { return false };
    match DateTime::parse_from_rfc3339(ts) {
        Ok(dt) => (Utc::now() - dt.with_timezone(&Utc)).num_days().abs() > FRESHNESS_DAYS,
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn entry(v: serde_json::Value) -> Entry {
        serde_json::from_value(v).unwrap()
    }

    fn cryptor() -> Cryptor {
        Cryptor::new("audit-test-secret")
    }

    // Build a login with its password encrypted, as it is on disk.
    fn login(c: &Cryptor, id: &str, password: &str, updated: Option<&str>) -> Entry {
        c.obscure(&entry(json!({
            "id": id, "type": "login", "title": "t",
            "password": password,
            "password_updated_at": updated,
        })))
        .unwrap()
    }

    #[test]
    fn skips_entries_without_password() {
        let c = cryptor();
        let entries = vec![
            entry(json!({ "id": "n", "type": "note", "title": "t", "note": "x" })),
            login(&c, "empty", "", None),
        ];
        assert!(audit(&c, &entries).unwrap().is_empty());
    }

    #[test]
    fn flags_short_and_weak() {
        let c = cryptor();
        let a = audit(&c, &[login(&c, "1", "abc", None)]).unwrap();
        let item = &a["1"];
        assert!(item.is_short);
        assert!(item.is_weak);
        assert!(!item.is_repeating);
    }

    #[test]
    fn strong_password_is_not_weak_or_short() {
        let c = cryptor();
        let a = audit(&c, &[login(&c, "1", "Abcdef1!ghij", None)]).unwrap();
        assert!(!a["1"].is_short);
        assert!(!a["1"].is_weak);
    }

    #[test]
    fn detects_repeating_passwords() {
        let c = cryptor();
        let a = audit(
            &c,
            &[
                login(&c, "1", "Repeated1!", None),
                login(&c, "2", "Repeated1!", None),
                login(&c, "3", "Unique2@ab", None),
            ],
        )
        .unwrap();
        assert!(a["1"].is_repeating);
        assert!(a["2"].is_repeating);
        assert!(!a["3"].is_repeating);
    }

    #[test]
    fn detects_old_passwords() {
        let c = cryptor();
        let old = (Utc::now() - chrono::Duration::days(120)).to_rfc3339();
        let fresh = (Utc::now() - chrono::Duration::days(10)).to_rfc3339();
        let a = audit(
            &c,
            &[
                login(&c, "old", "Str0ng!pass", Some(&old)),
                login(&c, "fresh", "Str0ng!pass", Some(&fresh)),
                login(&c, "missing", "Str0ng!pass", None),
            ],
        )
        .unwrap();
        assert!(a["old"].is_old);
        assert!(!a["fresh"].is_old);
        assert!(!a["missing"].is_old);
    }
}
