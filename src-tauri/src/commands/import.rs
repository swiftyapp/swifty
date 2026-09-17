//! Import/export commands — the boundary between the pure `import` parser and the
//! app's crypto/store. Parsing produces plaintext `ImportedEntry` values; writing
//! seals each with the session payload cipher (`PayloadCipher::seal` +
//! `migrate::build_record`) and upserts — the same seal/record convention as
//! `import_swftx`, so payload sealing is never reimplemented here.

use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::crypto::PayloadCipher;
use crate::error::{Error, Result};
use crate::events;
use crate::import::{self, EntryKind, Format, ImportedEntry, ImportedPasskey, RowError};
use crate::models::{Entry, EntryMetaDto, ExtraField, Passkey};
use crate::save;
use crate::session::{list_metas, live_records, store_err};
use crate::state::AppState;
use crate::store::{migrate, Record, VaultStore};

// Bound the input: a foreign export should never be gigabytes or millions of rows.
const MAX_BYTES: u64 = 25 * 1024 * 1024;
const MAX_ENTRIES: usize = 100_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowErrorDto {
    pub row: usize,
    pub message: String,
}

impl From<&RowError> for RowErrorDto {
    fn from(e: &RowError) -> Self {
        RowErrorDto {
            row: e.row,
            message: e.message.clone(),
        }
    }
}

// Preview (dry_run): `imported` is 0 and `total` is the would-be count. Real run:
// `imported` is what was written, `skipped` the rows that failed to parse, and
// `entries` the refreshed vault (empty on a preview, which wrote nothing).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub total: usize,
    pub imported: usize,
    pub skipped: usize,
    pub dry_run: bool,
    pub errors: Vec<RowErrorDto>,
    pub entries: Vec<EntryMetaDto>,
}

// What one blocking pass over the file produced: the parse, plus the sealed rows
// when it was a real run (a preview seals nothing).
struct Parsed {
    total: usize,
    errors: Vec<RowErrorDto>,
    records: Vec<Record>,
}

// Parse a foreign export and either preview it (dry_run) or write it into the open
// vault. `format` is an explicit name or "auto" to detect by extension/content.
//
// The read, the parse and the seal loop are one hop onto the blocking pool: a
// 25 MB export is disk I/O followed by a CPU-bound pass over every row, and
// neither belongs on the IPC thread or on an async worker.
#[tauri::command]
pub async fn import_entries(
    path: String,
    format: String,
    dry_run: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ImportReport> {
    // Taken before the file work, so a locked vault is turned away at once
    // instead of after parsing. A preview writes nothing and needs no cipher,
    // which is what lets it run on a vault that is not open. The epoch comes
    // with the cipher: the write below is only accepted by the session the
    // cipher belongs to (see `Session::store_at`).
    let (cipher, epoch) = match dry_run {
        true => (None, None),
        false => {
            let session = state.session.lock().unwrap();
            (Some(session.payload_cipher()?), Some(session.epoch()))
        }
    };

    let emitter = app.clone();
    let parsed = super::blocking(move || -> Result<Parsed> {
        let meta = fs::metadata(&path)?;
        if meta.len() > MAX_BYTES {
            return Err(Error::FileTooLarge);
        }
        let bytes = fs::read(&path)?;

        let fmt = if format.eq_ignore_ascii_case("auto") {
            let name = Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            import::detect(&name, &bytes)
                .ok_or_else(|| Error::Other("could not detect format".into()))?
        } else {
            Format::from_name(&format)
                .ok_or_else(|| Error::Other(format!("unknown format: {format}")))?
        };

        let parsed = fmt.importer().parse(&bytes);
        if parsed.entries.len() > MAX_ENTRIES {
            return Err(Error::Other("too many entries to import".into()));
        }
        let total = parsed.entries.len();
        let errors: Vec<RowErrorDto> = parsed.errors.iter().map(RowErrorDto::from).collect();

        // Seal every plaintext entry (seal payload + build a Record), emitting
        // progress — the same seal helper the rest of the app uses.
        let mut records = Vec::new();
        if let Some(cipher) = cipher {
            records.reserve(total);
            for (i, imported) in parsed.entries.iter().enumerate() {
                let entry = imported_to_entry(imported);
                let payload = cipher.seal(&entry)?;
                records.push(migrate::build_record(&entry, payload)?);
                events::import_progress(&emitter, i + 1, total);
            }
        }
        Ok(Parsed {
            total,
            errors,
            records,
        })
    })
    .await?;

    if dry_run {
        return Ok(ImportReport {
            total: parsed.total,
            imported: 0,
            skipped: parsed.errors.len(),
            dry_run: true,
            errors: parsed.errors,
            entries: Vec::new(),
        });
    }

    let session = state.session.lock().unwrap();
    let store = match epoch {
        Some(epoch) => session.store_at(epoch)?,
        None => session.store()?,
    };
    for record in &parsed.records {
        store.upsert(record).map_err(store_err)?;
    }

    Ok(ImportReport {
        total: parsed.total,
        imported: parsed.records.len(),
        skipped: parsed.errors.len(),
        dry_run: false,
        errors: parsed.errors,
        entries: list_metas(store)?,
    })
}

// Export the open vault to a third-party format. `path` may be supplied directly;
// when None, a save dialog is shown. `format` is "bitwarden", "cxf" or "csv".
#[tauri::command]
pub async fn export_entries(
    path: Option<String>,
    format: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>> {
    // Under the guard: read the sealed rows and take a *copy* of the payload
    // cipher. Unsealing every one of them is a pass over the whole vault, and
    // the session lock may not be held across that — the cipher is an owned
    // value precisely so it can leave with the records.
    let (cipher, records) = {
        let session = state.session.lock().unwrap();
        (session.payload_cipher()?, live_records(session.store()?)?)
    };

    let (bytes, ext) = super::blocking(move || {
        let entries = to_imported(&records, &cipher)?;
        Ok(match format.to_lowercase().as_str() {
            "bitwarden" => (import::export::to_bitwarden_json(&entries)?, "json"),
            "cxf" | "fido" => (import::export::to_cxf_json(&entries)?, "json"),
            "csv" => (
                import::export::to_generic_csv(&entries)
                    .map_err(|e| Error::Other(e.to_string()))?,
                "csv",
            ),
            other => return Err(Error::Other(format!("unknown export format: {other}"))),
        })
    })
    .await?;

    // An explicit path skips the dialog (the E2E suite exports to a temp file).
    let dest = match path {
        Some(p) => {
            let dest = save::with_extension(std::path::PathBuf::from(p), ext);
            fs::write(&dest, bytes)?;
            Some(dest)
        }
        None => save::save_export(&app, &format!("rowel-export.{ext}"), "Export", bytes).await?,
    };
    Ok(dest.map(|p| p.to_string_lossy().into_owned()))
}

// Stored records -> the plaintext rows an export is written from. Split out of
// the command so the unseal path can be tested without a Tauri app around it.
fn to_imported(records: &[Record], cipher: &PayloadCipher) -> Result<Vec<ImportedEntry>> {
    records
        .iter()
        .map(|r| Ok(entry_to_imported(&cipher.unseal(&r.id, &r.payload)?)))
        .collect()
}

// ImportedEntry -> a plaintext models::Entry, ready to be obscured + sealed.
fn imported_to_entry(imp: &ImportedEntry) -> Entry {
    let now = chrono::Utc::now().to_rfc3339();
    // The kind's own fields are set in the match below; everything else stays
    // at its default (None, so a field the kind does not own never serializes).
    let mut e = Entry {
        id: migrate::new_entry_id(),
        kind: imp.kind.as_str().to_string(),
        title: imp.title.clone(),
        note: imp.notes.clone(),
        tags: (!imp.tags.is_empty()).then(|| imp.tags.clone()),
        // Extras belong to no kind, so they are mapped here rather than in the
        // match below. None when there are none, for the same reason.
        extra: (!imp.extra.is_empty()).then(|| {
            imp.extra
                .iter()
                .map(|(label, value)| ExtraField {
                    label: label.clone(),
                    value: value.clone(),
                })
                .collect()
        }),
        created_at: Some(now.clone()),
        updated_at: Some(now),
        ..Default::default()
    };
    match imp.kind {
        EntryKind::Login => {
            e.username = imp.username.clone();
            e.password = imp.password.clone();
            e.website = imp.url.clone();
            e.otp = imp.otp.clone();
            e.passkeys =
                (!imp.passkeys.is_empty()).then(|| imp.passkeys.iter().map(to_passkey).collect());
        }
        EntryKind::Card => {
            e.number = imp.card_number.clone();
            e.month = imp.card_month.clone();
            e.year = imp.card_year.clone();
            e.cvc = imp.card_cvc.clone();
            e.name = imp.cardholder.clone();
        }
        EntryKind::Identity => {
            e.doc_type = imp.doc_type.clone();
            e.number = imp.doc_number.clone();
            e.country = imp.doc_country.clone();
            e.name = imp.holder_name.clone();
        }
        EntryKind::Ssh => {
            e.private_key = imp.ssh_private_key.clone();
            e.public_key = imp.ssh_public_key.clone();
            e.fingerprint = imp.ssh_fingerprint.clone();
            e.passphrase = imp.ssh_passphrase.clone();
        }
        EntryKind::Env => {
            e.body = imp.env_body.clone();
            e.file_name = imp.env_file_name.clone();
        }
        EntryKind::ApiKey => {
            e.api_key = imp.api_key.clone();
            e.base_url = imp.url.clone();
            e.environment = imp.api_environment.clone();
            e.scopes = imp.api_scopes.clone();
            e.expiry_date = imp.api_expires.clone();
        }
        EntryKind::Note => {}
    }
    e
}

// A plaintext (exposed) models::Entry -> ImportedEntry for export.
fn entry_to_imported(e: &Entry) -> ImportedEntry {
    let kind = match e.kind.as_str() {
        "note" => EntryKind::Note,
        "card" => EntryKind::Card,
        "identity" => EntryKind::Identity,
        "ssh" => EntryKind::Ssh,
        "env" => EntryKind::Env,
        "apikey" => EntryKind::ApiKey,
        _ => EntryKind::Login,
    };
    // `number` and `name` are shared slots, so they are only read into the
    // identity columns for an identity — a card must not export as one.
    let identity = kind == EntryKind::Identity;
    let api_key = kind == EntryKind::ApiKey;
    ImportedEntry {
        kind,
        title: e.title.clone(),
        username: e.username.clone(),
        password: e.password.clone(),
        // An API key's site is the API it is sent to.
        url: if api_key {
            e.base_url.clone()
        } else {
            e.website.clone()
        },
        notes: e.note.clone(),
        otp: e.otp.clone(),
        tags: e.tags.clone().unwrap_or_default(),
        card_number: (!identity).then(|| e.number.clone()).flatten(),
        card_month: e.month.clone(),
        card_year: e.year.clone(),
        card_cvc: e.cvc.clone(),
        cardholder: (!identity).then(|| e.name.clone()).flatten(),
        doc_type: e.doc_type.clone(),
        doc_number: identity.then(|| e.number.clone()).flatten(),
        doc_country: e.country.clone(),
        holder_name: identity.then(|| e.name.clone()).flatten(),
        ssh_private_key: e.private_key.clone(),
        ssh_public_key: e.public_key.clone(),
        ssh_fingerprint: e.fingerprint.clone(),
        ssh_passphrase: e.passphrase.clone(),
        env_body: e.body.clone(),
        env_file_name: e.file_name.clone(),
        api_key: e.api_key.clone(),
        api_environment: e.environment.clone(),
        api_scopes: e.scopes.clone(),
        // `expiry_date` is shared with the identity, so it is only read here
        // for an API key — a passport must not export with one.
        api_expires: api_key.then(|| e.expiry_date.clone()).flatten(),
        passkeys: e
            .passkeys
            .as_deref()
            .unwrap_or_default()
            .iter()
            .map(to_imported_passkey)
            .collect(),
        extra: e
            .extra
            .as_deref()
            .unwrap_or_default()
            .iter()
            .map(|f| (f.label.clone(), f.value.clone()))
            .collect(),
    }
}

// The two halves of the passkey mapping. Field-for-field: the import layer's
// struct mirrors `models::Passkey`, and base64url values cross unchanged.
fn to_passkey(p: &ImportedPasskey) -> Passkey {
    Passkey {
        credential_id: p.credential_id.clone(),
        rp_id: p.rp_id.clone(),
        rp_name: p.rp_name.clone(),
        user_handle: p.user_handle.clone(),
        user_name: p.user_name.clone(),
        user_display_name: p.user_display_name.clone(),
        private_key: p.private_key.clone(),
        counter: p.counter,
        created_at: p.created_at.clone(),
    }
}

fn to_imported_passkey(p: &Passkey) -> ImportedPasskey {
    ImportedPasskey {
        credential_id: p.credential_id.clone(),
        rp_id: p.rp_id.clone(),
        rp_name: p.rp_name.clone(),
        user_handle: p.user_handle.clone(),
        user_name: p.user_name.clone(),
        user_display_name: p.user_display_name.clone(),
        private_key: p.private_key.clone(),
        counter: p.counter,
        created_at: p.created_at.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{self, KdfParams, VaultKey};
    use crate::store::SqliteStore;

    // Cheap Argon2id params: this proves which cipher the export reads with,
    // not how expensive the KDF is.
    fn argon2_vault(path: &Path) -> (VaultKey, SqliteStore) {
        let params = KdfParams::argon2id(b"salt-for-the-export-test", 256, 1, 1);
        let key = VaultKey::Argon2 {
            master: crypto::derive(b"master-password", &params).unwrap(),
        };
        let store = SqliteStore::open(path, &key.sqlcipher_key()).unwrap();
        (key, store)
    }

    fn tmp_db() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("rowel-export-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("vault.db");
        let _ = std::fs::remove_file(&path);
        path
    }

    // Every vault this app creates seals payloads with the AEAD payload cipher,
    // so an export that reaches for the legacy cryptor reads nothing at all.
    #[test]
    fn exports_an_entry_sealed_the_way_save_entry_seals_it() {
        let path = tmp_db();
        let (key, store) = argon2_vault(&path);
        let entry: Entry = serde_json::from_value(serde_json::json!({
            "id": "1", "type": "login", "title": "Site",
            "website": "https://ex.com/login", "username": "alice", "password": "s3cret"
        }))
        .unwrap();

        let cipher = key.payload_cipher();
        let record = migrate::build_record(&entry, cipher.seal(&entry).unwrap()).unwrap();
        store.upsert(&record).unwrap();

        let records = live_records(&store).unwrap();
        let exported = to_imported(&records, &cipher).unwrap();

        assert_eq!(exported.len(), 1);
        assert_eq!(exported[0].title, "Site");
        assert_eq!(exported[0].username.as_deref(), Some("alice"));
        assert_eq!(exported[0].password.as_deref(), Some("s3cret"));

        drop(store);
        std::fs::remove_dir_all(path.parent().unwrap()).ok();
    }
}
