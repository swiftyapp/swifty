//! Boundary adapter: legacy JSON `vault.swftx` → the new store. This is the one
//! file in the module that references the app's crypto/models — it is glue, not
//! part of the pure trait, and stays thin. The store itself never sees this.

use std::fs;
use std::path::Path;

use super::{Record, VaultStore};
use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::models::{Entry, VaultData};

/// Read the encrypted legacy vault at `path`, decrypt it with `cryptor`, write
/// every entry into `store` as a `Record` (payload = the app-encrypted blob),
/// and retain the JSON alongside as `<path>.bak`. Returns the entry count.
pub fn migrate_from_json(path: &Path, cryptor: &Cryptor, store: &impl VaultStore) -> Result<usize> {
    let blob = fs::read_to_string(path)?;
    let vault: VaultData = cryptor.decrypt_data(&blob)?;

    let records = records_from_entries(&vault.entries, cryptor)?;
    store
        .import(&records)
        .map_err(|e| Error::Other(e.to_string()))?;

    backup(path)?;
    Ok(records.len())
}

/// Map obscured (per-field-encrypted) entries to store `Record`s: metadata to
/// columns, the whole entry re-sealed into the opaque payload. Shared by the
/// JSON migration, backup restore, and per-entry save so the payload/metadata
/// convention lives in exactly one place.
pub fn records_from_entries(entries: &[Entry], cryptor: &Cryptor) -> Result<Vec<Record>> {
    entries.iter().map(|e| to_record(e, cryptor)).collect()
}

/// Re-key one obscured entry from a *source* cryptor to the *current* one: expose
/// its fields under `src`, re-obscure under `cur`, then seal a fresh `Record`.
/// Used by `import_swftx` to merge a foreign `.swftx` encrypted under a different
/// master password than the open vault's. Reuses `to_record`, so the
/// payload/metadata convention stays in one place.
pub fn rekey_record(src: &Cryptor, cur: &Cryptor, entry: &Entry) -> Result<Record> {
    let exposed = src.expose(entry)?;
    let reobscured = cur.obscure(&exposed)?;
    to_record(&reobscured, cur)
}

// One obscured entry → one Record. Metadata goes to columns; the whole entry is
// re-sealed by the app cryptor into the opaque payload (lossless round-trip).
fn to_record(entry: &Entry, cryptor: &Cryptor) -> Result<Record> {
    let payload = cryptor.encrypt_data(entry)?.into_bytes();
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

// Copy the JSON vault to `<path>.bak`, never removing the original.
fn backup(path: &Path) -> Result<()> {
    let mut bak = path.as_os_str().to_owned();
    bak.push(".bak");
    fs::copy(path, bak)?;
    Ok(())
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
