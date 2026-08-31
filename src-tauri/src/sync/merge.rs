//! Port of legacy `sync/base/merge.js`. Works on the on-disk blob format
//! (encrypt_data): decrypt both vaults, merge their obscured entries keyed by
//! id, re-encrypt. Entry fields are deep-merged with the newer vault winning.

use chrono::{DateTime, Local};
use serde_json::{json, Value};

use crate::crypto::Cryptor;
use crate::error::{Error, Result};

type Group = (Vec<(String, Value)>, Option<DateTime<chrono::FixedOffset>>);

// Merge `local` and `remote` encrypted vault blobs into a new encrypted blob.
pub fn merge_data(local: &str, remote: &str, cryptor: &Cryptor) -> Result<String> {
    if remote.trim().is_empty() {
        return Ok(local.to_string());
    }
    let local_v: Value = cryptor.decrypt_data(local)?;
    let remote_v: Value = cryptor
        .decrypt_data(remote)
        .map_err(|_| Error::Crypto("Failed to decrypt remote vault file".into()))?;

    let entries = combine(group(&local_v), group(&remote_v));
    cryptor.encrypt_data(&json!({ "entries": entries, "updatedAt": now() }))
}

// The newer vault is the "update" that wins on conflicts (see merge_into).
fn combine(local: Group, remote: Group) -> Vec<Value> {
    let remote_newer = matches!((remote.1, local.1), (Some(r), Some(l)) if r > l);
    if remote_newer {
        merge_into(local.0, remote.0)
    } else {
        merge_into(remote.0, local.0)
    }
}

// For each base entry: deep-merge the matching update entry (update wins) or, if
// absent from update, drop it. Then append entries only present in update.
fn merge_into(base: Vec<(String, Value)>, mut update: Vec<(String, Value)>) -> Vec<Value> {
    let mut result = Vec::new();
    for (key, mut value) in base {
        if let Some(pos) = update.iter().position(|(k, _)| *k == key) {
            deep_merge(&mut value, update.remove(pos).1);
            result.push(value);
        }
    }
    result.extend(update.into_iter().map(|(_, v)| v));
    result
}

// lodash `merge`: recurse into objects/arrays, otherwise overwrite.
fn deep_merge(base: &mut Value, update: Value) {
    match (base, update) {
        (Value::Object(b), Value::Object(u)) => {
            for (k, v) in u {
                match b.get_mut(&k) {
                    Some(bv) => deep_merge(bv, v),
                    None => {
                        b.insert(k, v);
                    }
                }
            }
        }
        (Value::Array(b), Value::Array(u)) => {
            for (i, v) in u.into_iter().enumerate() {
                match b.get_mut(i) {
                    Some(bv) => deep_merge(bv, v),
                    None => b.push(v),
                }
            }
        }
        (b, u) => *b = u,
    }
}

// Group entries by id (insertion order preserved) with the vault's timestamp.
fn group(vault: &Value) -> Group {
    let entries = vault
        .get("entries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|e| {
            let id = e
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            (id, e)
        })
        .collect();
    let ts = vault
        .get("updatedAt")
        .and_then(Value::as_str)
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok());
    (entries, ts)
}

fn now() -> String {
    Local::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn enc(cryptor: &Cryptor, entries: Value, updated_at: &str) -> String {
        cryptor
            .encrypt_data(&json!({ "entries": entries, "updatedAt": updated_at }))
            .unwrap()
    }

    fn ids(vault: &Value) -> Vec<String> {
        vault["entries"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["id"].as_str().unwrap().to_string())
            .collect()
    }

    #[test]
    fn newer_vault_wins_on_conflicting_fields() {
        let c = Cryptor::new("secret");
        let local = enc(
            &c,
            json!([{ "id": "a", "title": "old", "note": "keep" }]),
            "2024-01-01T00:00:00+00:00",
        );
        let remote = enc(
            &c,
            json!([{ "id": "a", "title": "new" }]),
            "2024-06-01T00:00:00+00:00",
        );
        let merged: Value = c
            .decrypt_data(&merge_data(&local, &remote, &c).unwrap())
            .unwrap();
        let e = &merged["entries"][0];
        assert_eq!(e["title"], "new"); // remote (newer) wins
        assert_eq!(e["note"], "keep"); // field only in local is preserved
    }

    #[test]
    fn entry_only_in_newer_is_added_only_in_older_is_dropped() {
        let c = Cryptor::new("secret");
        // remote is newer, so it is authoritative for which entries exist.
        let local = enc(
            &c,
            json!([{ "id": "a" }, { "id": "old_only" }]),
            "2024-01-01T00:00:00+00:00",
        );
        let remote = enc(
            &c,
            json!([{ "id": "a" }, { "id": "new_only" }]),
            "2024-06-01T00:00:00+00:00",
        );
        let merged: Value = c
            .decrypt_data(&merge_data(&local, &remote, &c).unwrap())
            .unwrap();
        let got = ids(&merged);
        assert!(got.contains(&"a".to_string()));
        assert!(got.contains(&"new_only".to_string()));
        assert!(!got.contains(&"old_only".to_string())); // dropped: only in older vault
    }

    #[test]
    fn local_newer_makes_local_authoritative() {
        let c = Cryptor::new("secret");
        let local = enc(
            &c,
            json!([{ "id": "a", "title": "local" }, { "id": "local_only" }]),
            "2024-06-01T00:00:00+00:00",
        );
        let remote = enc(
            &c,
            json!([{ "id": "a", "title": "remote" }, { "id": "remote_only" }]),
            "2024-01-01T00:00:00+00:00",
        );
        let merged: Value = c
            .decrypt_data(&merge_data(&local, &remote, &c).unwrap())
            .unwrap();
        assert_eq!(merged["entries"][0]["title"], "local");
        let got = ids(&merged);
        assert!(got.contains(&"local_only".to_string()));
        assert!(!got.contains(&"remote_only".to_string()));
    }

    #[test]
    fn empty_remote_returns_local_unchanged() {
        let c = Cryptor::new("secret");
        let local = enc(&c, json!([{ "id": "a" }]), "2024-01-01T00:00:00+00:00");
        assert_eq!(merge_data(&local, "", &c).unwrap(), local);
    }

    #[test]
    fn undecryptable_remote_errors() {
        let c = Cryptor::new("secret");
        let local = enc(&c, json!([{ "id": "a" }]), "2024-01-01T00:00:00+00:00");
        assert!(merge_data(&local, "not-a-valid-blob", &c).is_err());
    }
}
