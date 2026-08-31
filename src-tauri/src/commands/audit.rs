use std::collections::HashMap;

use crate::commands::live_records;
use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::hibp;
use crate::models::{Audit, AuditItem, Entry};
use crate::state::AppState;
use tauri::State;
use zxcvbn::zxcvbn;

// zxcvbn scores 0-4; below 3 ("safely unguessable") is treated as weak. This
// replaces NIST-discredited composition rules and already accounts for length,
// dictionary words, keyboard walks and l33t substitutions.
const WEAK_SCORE: u8 = 3;

// Audit every password in the unlocked vault: strength (zxcvbn), reuse, and —
// when the user opts in — breach exposure (HIBP k-anonymity). Passwords are
// stored encrypted, so decryption and the network call run off the UI thread.
#[tauri::command]
pub async fn get_audit(state: State<'_, AppState>, check_breaches: bool) -> Result<Audit> {
    // Collect the encrypted payloads under the lock, then unseal + score off the
    // UI thread (payload unseal and each password decrypt run PBKDF2).
    let (cryptor, payloads) = {
        let s = state.session.lock().unwrap();
        let payloads: Vec<Vec<u8>> = live_records(s.store()?)?
            .into_iter()
            .map(|r| r.payload)
            .collect();
        (s.cryptor()?, payloads)
    };
    tauri::async_runtime::spawn_blocking(move || {
        let entries: Vec<Entry> = payloads
            .iter()
            .map(|p| {
                let blob = std::str::from_utf8(p).map_err(|e| Error::Crypto(e.to_string()))?;
                cryptor.decrypt_data(blob)
            })
            .collect::<Result<_>>()?;
        audit(&cryptor, &entries, check_breaches)
    })
    .await
    .map_err(|e| Error::Crypto(e.to_string()))?
}

// Decrypt each non-empty password once, then flag weak / reused / breached.
fn audit(cryptor: &Cryptor, entries: &[Entry], check_breaches: bool) -> Result<Audit> {
    let creds: Vec<(&Entry, String)> = entries
        .iter()
        .filter_map(|e| {
            e.password
                .as_deref()
                .filter(|p| !p.is_empty())
                .map(|p| (e, p))
        })
        .map(|(e, p)| Ok((e, cryptor.decrypt(p)?)))
        .collect::<Result<_>>()?;

    let passwords: Vec<&str> = creds.iter().map(|(_, p)| p.as_str()).collect();
    let breaches: HashMap<String, bool> = if check_breaches {
        hibp::check_all(&passwords)
    } else {
        HashMap::new()
    };

    Ok(creds
        .iter()
        .map(|(e, p)| {
            let repeating = passwords.iter().filter(|&&x| x == p).count() > 1;
            let score = u8::from(zxcvbn(p, &[]).score());
            (
                e.id.clone(),
                AuditItem {
                    score,
                    is_weak: score < WEAK_SCORE,
                    is_repeating: repeating,
                    breached: breaches.get(p).copied().unwrap_or(false),
                },
            )
        })
        .collect())
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
    fn login(c: &Cryptor, id: &str, password: &str) -> Entry {
        c.obscure(&entry(json!({
            "id": id, "type": "login", "title": "t",
            "password": password,
        })))
        .unwrap()
    }

    #[test]
    fn skips_entries_without_password() {
        let c = cryptor();
        let entries = vec![
            entry(json!({ "id": "n", "type": "note", "title": "t", "note": "x" })),
            login(&c, "empty", ""),
        ];
        assert!(audit(&c, &entries, false).unwrap().is_empty());
    }

    #[test]
    fn flags_weak_by_score() {
        let c = cryptor();
        let a = audit(&c, &[login(&c, "1", "abc")], false).unwrap();
        assert!(a["1"].is_weak);
        assert!(a["1"].score < WEAK_SCORE);
        assert!(!a["1"].is_repeating);
        assert!(!a["1"].breached);
    }

    #[test]
    fn strong_passphrase_is_not_weak() {
        let c = cryptor();
        let a = audit(&c, &[login(&c, "1", "correct horse battery staple")], false).unwrap();
        assert!(!a["1"].is_weak);
        assert!(a["1"].score >= WEAK_SCORE);
    }

    #[test]
    fn detects_repeating_passwords() {
        let c = cryptor();
        let a = audit(
            &c,
            &[
                login(&c, "1", "Repeated1!"),
                login(&c, "2", "Repeated1!"),
                login(&c, "3", "Unique2@ab"),
            ],
            false,
        )
        .unwrap();
        assert!(a["1"].is_repeating);
        assert!(a["2"].is_repeating);
        assert!(!a["3"].is_repeating);
    }

    // Opt-out (check_breaches = false) makes no network call and leaves breached false.
    #[test]
    fn breach_check_is_skipped_when_opted_out() {
        let c = cryptor();
        let a = audit(&c, &[login(&c, "1", "password")], false).unwrap();
        assert!(!a["1"].breached);
    }
}
