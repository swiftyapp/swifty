//! Boundary adapter between app entries and store `Record`s. This is the one
//! file in the module that references the app's crypto/models — it is glue, not
//! part of the pure trait, and stays thin. The store itself never sees it.

use super::Record;
use crate::crypto::{Cryptor, PayloadCipher};
use crate::error::Result;
use crate::models::Entry;

/// Package a plaintext entry + its already-sealed payload into a store `Record`:
/// non-secret metadata to columns, the opaque payload as-is. The single place the
/// metadata/payload convention lives, shared by save and the `.swftx` imports.
pub fn build_record(entry: &Entry, payload: Vec<u8>) -> Result<Record> {
    Ok(Record {
        id: entry.id.clone(),
        kind: entry.kind.clone(),
        title: entry.title.clone(),
        tags: serde_json::to_string(&entry.tags.clone().unwrap_or_default())?,
        url_host: host_of(entry.website.as_deref().unwrap_or_default()),
        created_at: to_ms(&entry.created_at),
        updated_at: to_ms(&entry.updated_at),
        deleted_at: None,
        payload,
    })
}

/// Re-seal `.swftx` entries (obscured under the source `Cryptor`, possibly a
/// different master password) under the current session's payload cipher: expose
/// each entry's plaintext, seal it, build a `Record`. Used by `import_backup` and
/// `import_swftx`.
pub fn reseal_swftx(
    entries: &[Entry],
    src: &Cryptor,
    cipher: &PayloadCipher,
) -> Result<Vec<Record>> {
    entries.iter().map(|e| reseal_one(e, src, cipher)).collect()
}

/// Re-seal a single `.swftx` entry (used by the progress-emitting import loop).
pub fn reseal_one(obscured: &Entry, src: &Cryptor, cipher: &PayloadCipher) -> Result<Record> {
    let plain = src.expose(obscured)?;
    let payload = cipher.seal(&plain)?;
    build_record(&plain, payload)
}

fn host_of(website: &str) -> String {
    let s = website.trim();
    let s = s
        .strip_prefix("https://")
        .or_else(|| s.strip_prefix("http://"))
        .unwrap_or(s);
    s.split('/').next().unwrap_or("").to_string()
}

fn to_ms(iso: &Option<String>) -> i64 {
    iso.as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.timestamp_millis())
        .unwrap_or_else(|| chrono::Utc::now().timestamp_millis())
}
