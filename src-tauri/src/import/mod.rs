//! Third-party import/export. Turns a foreign export file into a list of
//! normalized [`ImportedEntry`] values plus per-row errors — and the reverse for
//! export. This module is **pure**: it only parses/serializes bytes. It never
//! encrypts, never touches the store, and knows nothing about the app's crypto or
//! Tauri. The command layer (`commands::import`) owns the seal + upsert.
//!
//! Adding a format = adding one [`Importer`] adapter and one [`Format`] variant.
//! The trait is byte-in / result-out, so a zipped format (1Password `.1pux`) slots
//! in later without reshaping anything.

mod bitwarden;
mod csv;
mod cxf;
pub mod export;

#[cfg(test)]
mod tests;

/// The kind of a normalized entry; maps 1:1 onto `models::Entry.kind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum EntryKind {
    #[default]
    Login,
    Note,
    Card,
}

impl EntryKind {
    pub fn as_str(self) -> &'static str {
        match self {
            EntryKind::Login => "login",
            EntryKind::Note => "note",
            EntryKind::Card => "card",
        }
    }
}

/// A normalized, plaintext entry — the shared intermediate for both import and
/// export. Maps cleanly onto `models::Entry` (the mapping lives at the command
/// boundary so this stays crypto/store-free).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ImportedEntry {
    pub kind: EntryKind,
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub otp: Option<String>,
    pub tags: Vec<String>,
    // Card fields (only meaningful when kind == Card).
    pub card_number: Option<String>,
    pub card_month: Option<String>,
    pub card_year: Option<String>,
    pub card_cvc: Option<String>,
    pub cardholder: Option<String>,
    // WebAuthn passkeys (only meaningful when kind == Login). Empty when the
    // source format carries none, which is the case for every CSV dialect.
    pub passkeys: Vec<ImportedPasskey>,
}

/// A normalized, plaintext passkey — mirrors `models::Passkey` field for field.
/// Base64url values are carried through verbatim; this module never re-encodes.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ImportedPasskey {
    pub credential_id: String,
    pub rp_id: String,
    pub rp_name: Option<String>,
    pub user_handle: String,
    pub user_name: String,
    pub user_display_name: String,
    pub private_key: String,
    pub counter: u32,
    pub created_at: Option<String>,
}

/// A per-row parse failure. `row` is 1-based in the source file so it points a
/// user at the offending line. A bad row is recorded here, never thrown.
#[derive(Debug, Clone, PartialEq)]
pub struct RowError {
    pub row: usize,
    pub message: String,
}

/// The outcome of parsing a file: the entries that parsed plus the rows that
/// didn't. One malformed row never aborts the batch.
#[derive(Debug, Default, PartialEq)]
pub struct ImportResult {
    pub entries: Vec<ImportedEntry>,
    pub errors: Vec<RowError>,
}

impl ImportResult {
    fn push_err(&mut self, row: usize, message: impl Into<String>) {
        self.errors.push(RowError {
            row,
            message: message.into(),
        });
    }
}

/// Byte-in / result-out. The whole contract for a format adapter.
pub trait Importer {
    fn parse(&self, bytes: &[u8]) -> ImportResult;
}

/// The formats we can import.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Bitwarden,
    Cxf, // FIDO Credential Exchange Format — the other JSON shape we read
    GenericCsv,
    BrowserCsv, // Chrome / Safari share a header-aliased shape
    LastpassCsv,
    KeepassCsv,
}

impl Format {
    /// Resolve an explicit format name from the frontend.
    pub fn from_name(name: &str) -> Option<Format> {
        match name.trim().to_lowercase().as_str() {
            "bitwarden" => Some(Format::Bitwarden),
            "cxf" | "fido" => Some(Format::Cxf),
            "csv" | "generic" | "generic_csv" => Some(Format::GenericCsv),
            "chrome" | "safari" | "browser" | "browser_csv" => Some(Format::BrowserCsv),
            "lastpass" | "lastpass_csv" => Some(Format::LastpassCsv),
            "keepass" | "keepass_csv" => Some(Format::KeepassCsv),
            _ => None,
        }
    }

    /// The adapter for this format.
    pub fn importer(self) -> Box<dyn Importer> {
        match self {
            Format::Bitwarden => Box::new(bitwarden::Bitwarden),
            Format::Cxf => Box::new(cxf::Cxf),
            Format::GenericCsv => Box::new(csv::GenericCsv),
            Format::BrowserCsv => Box::new(csv::BrowserCsv),
            Format::LastpassCsv => Box::new(csv::LastpassCsv),
            Format::KeepassCsv => Box::new(csv::KeepassCsv),
        }
    }
}

/// Best-effort format detection by file name then content — a convenience so the
/// UI can offer "auto". Explicit selection always wins upstream.
pub fn detect(name: &str, bytes: &[u8]) -> Option<Format> {
    let lower = name.to_lowercase();
    if lower.ends_with(".json") {
        return Some(detect_json(bytes));
    }
    if lower.ends_with(".csv") {
        return Some(detect_csv(bytes));
    }
    // Fall back to content sniffing when the extension is unhelpful.
    if bytes.iter().find(|b| !b.is_ascii_whitespace()) == Some(&b'{') {
        return Some(detect_json(bytes));
    }
    if !bytes.is_empty() {
        return Some(detect_csv(bytes));
    }
    None
}

// Both JSON formats we read are top-level objects; CXF is the one that declares
// a `version` object and an `accounts` array. Parsed once, then thrown away —
// an explicit choice from the UI skips this entirely.
fn detect_json(bytes: &[u8]) -> Format {
    let Ok(doc) = serde_json::from_slice::<serde_json::Value>(bytes) else {
        return Format::Bitwarden;
    };
    let cxf = doc.get("accounts").is_some_and(serde_json::Value::is_array)
        && doc.get("version").is_some_and(serde_json::Value::is_object);
    if cxf {
        Format::Cxf
    } else {
        Format::Bitwarden
    }
}

// Pick a CSV dialect from the header row's column names.
fn detect_csv(bytes: &[u8]) -> Format {
    let header = String::from_utf8_lossy(bytes);
    let first = header.lines().next().unwrap_or("").to_lowercase();
    let has = |c: &str| first.split(',').any(|h| h.trim().trim_matches('"') == c);
    if has("grouping") || (has("extra") && has("name") && has("url")) {
        Format::LastpassCsv
    } else if has("group") && has("title") {
        Format::KeepassCsv
    } else {
        Format::GenericCsv
    }
}
