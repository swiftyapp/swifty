//! Import/export commands — the boundary between the pure `import` parser and the
//! app's crypto/store. Parsing produces plaintext `ImportedEntry` values; writing
//! seals each with the session payload cipher (`PayloadCipher::seal` +
//! `migrate::build_record`) and upserts — the same seal/record convention as
//! `import_swftx`, so payload sealing is never reimplemented here.

use std::fs;
use std::path::Path;

use rand::RngCore;
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

use crate::commands::store_err;
use crate::error::{Error, Result};
use crate::import::{self, EntryKind, Format, ImportedEntry, RowError};
use crate::models::Entry;
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
// `imported` is what was written, `skipped` the rows that failed to parse.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub total: usize,
    pub imported: usize,
    pub skipped: usize,
    pub dry_run: bool,
    pub errors: Vec<RowErrorDto>,
}

// Open a file picker for a third-party export (JSON / CSV).
// Async + spawn_blocking so the blocking picker never runs on the main thread
// (which would deadlock the event loop and hang the window).
#[tauri::command]
pub async fn pick_import_file(app: AppHandle) -> Result<Option<String>> {
    let file = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Password exports", &["json", "csv"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?;
    Ok(file
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
}

// Parse a foreign export and either preview it (dry_run) or write it into the open
// vault. `format` is an explicit name or "auto" to detect by extension/content.
#[tauri::command]
pub async fn import_entries(
    path: String,
    format: String,
    dry_run: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ImportReport> {
    let meta = fs::metadata(&path)?;
    if meta.len() > MAX_BYTES {
        return Err(Error::Other("file too large to import".into()));
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
    let errors: Vec<RowErrorDto> = parsed.errors.iter().map(RowErrorDto::from).collect();

    if dry_run {
        return Ok(ImportReport {
            total: parsed.entries.len(),
            imported: 0,
            skipped: parsed.errors.len(),
            dry_run: true,
            errors,
        });
    }

    let cipher = state.session.lock().unwrap().payload_cipher()?;
    let entries: Vec<Entry> = parsed.entries.iter().map(imported_to_entry).collect();

    // Seal every plaintext entry off the UI thread (seal payload + build a
    // Record), emitting progress — the same seal helper the rest of the app uses.
    let emitter = app.clone();
    let records = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<Record>> {
        let total = entries.len();
        let mut records = Vec::with_capacity(total);
        for (i, entry) in entries.iter().enumerate() {
            let payload = cipher.seal(entry)?;
            records.push(migrate::build_record(entry, payload)?);
            let _ = emitter.emit("import:progress", json!({ "done": i + 1, "total": total }));
        }
        Ok(records)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))??;

    {
        let session = state.session.lock().unwrap();
        let store = session.store()?;
        for record in &records {
            store.upsert(record).map_err(store_err)?;
        }
    }
    let imported = records.len();
    let _ = app.emit("import:done", json!({ "count": imported }));

    Ok(ImportReport {
        total: parsed.entries.len(),
        imported,
        skipped: parsed.errors.len(),
        dry_run: false,
        errors,
    })
}

// Export the open vault to a third-party format. `path` may be supplied directly;
// when None, a save dialog is shown. `format` is "bitwarden" or "csv".
#[tauri::command]
pub async fn export_entries(
    path: Option<String>,
    format: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>> {
    let entries: Vec<ImportedEntry> = {
        let session = state.session.lock().unwrap();
        let cryptor = session.cryptor()?;
        crate::commands::live_records(session.store()?)?
            .into_iter()
            .map(|r| {
                let blob =
                    String::from_utf8(r.payload).map_err(|e| Error::Crypto(e.to_string()))?;
                let obscured: Entry = cryptor.decrypt_data(&blob)?;
                let plain = cryptor.expose(&obscured)?;
                Ok(entry_to_imported(&plain))
            })
            .collect::<Result<Vec<_>>>()?
    };

    let (bytes, ext) = match format.to_lowercase().as_str() {
        "bitwarden" => (import::export::to_bitwarden_json(&entries)?, "json"),
        "csv" => (
            import::export::to_generic_csv(&entries).map_err(|e| Error::Other(e.to_string()))?,
            "csv",
        ),
        other => return Err(Error::Other(format!("unknown export format: {other}"))),
    };

    let dest = match path {
        Some(p) => Some(std::path::PathBuf::from(p)),
        None => {
            // Off-main-thread so the blocking save dialog can't hang the window.
            let chosen = tauri::async_runtime::spawn_blocking(move || {
                app.dialog()
                    .file()
                    .set_file_name(format!("swifty-export.{ext}"))
                    .add_filter("Export", &[ext])
                    .blocking_save_file()
            })
            .await
            .map_err(|e| Error::Other(e.to_string()))?;
            chosen.and_then(|f| f.into_path().ok())
        }
    };
    let Some(dest) = dest else {
        return Ok(None);
    };
    let dest = match dest.extension() {
        Some(e) if e == ext => dest,
        _ => dest.with_extension(ext),
    };
    fs::write(&dest, bytes)?;
    Ok(Some(dest.to_string_lossy().into_owned()))
}

// A random 16-byte hex id for a freshly imported entry.
fn new_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

// ImportedEntry -> a plaintext models::Entry, ready to be obscured + sealed.
fn imported_to_entry(imp: &ImportedEntry) -> Entry {
    let now = chrono::Utc::now().to_rfc3339();
    let mut e = Entry {
        id: new_id(),
        kind: imp.kind.as_str().to_string(),
        title: imp.title.clone(),
        username: None,
        password: None,
        website: None,
        email: None,
        otp: None,
        note: imp.notes.clone(),
        number: None,
        month: None,
        year: None,
        cvc: None,
        pin: None,
        name: None,
        tags: (!imp.tags.is_empty()).then(|| imp.tags.clone()),
        created_at: Some(now.clone()),
        updated_at: Some(now),
        password_updated_at: None,
    };
    match imp.kind {
        EntryKind::Login => {
            e.username = imp.username.clone();
            e.password = imp.password.clone();
            e.website = imp.url.clone();
            e.otp = imp.otp.clone();
        }
        EntryKind::Card => {
            e.number = imp.card_number.clone();
            e.month = imp.card_month.clone();
            e.year = imp.card_year.clone();
            e.cvc = imp.card_cvc.clone();
            e.name = imp.cardholder.clone();
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
        _ => EntryKind::Login,
    };
    ImportedEntry {
        kind,
        title: e.title.clone(),
        username: e.username.clone(),
        password: e.password.clone(),
        url: e.website.clone(),
        notes: e.note.clone(),
        otp: e.otp.clone(),
        tags: e.tags.clone().unwrap_or_default(),
        card_number: e.number.clone(),
        card_month: e.month.clone(),
        card_year: e.year.clone(),
        card_cvc: e.cvc.clone(),
        cardholder: e.name.clone(),
    }
}
