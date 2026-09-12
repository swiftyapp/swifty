//! CSV adapters. All share one reader + a header-name lookup, then each maps
//! columns its own way: generic/browser via aliases, LastPass and KeePass via
//! their fixed schemas. `row` numbers are 1-based over the source file (header is
//! row 1), so a reported error points at the real line.

use ::csv::{ReaderBuilder, StringRecord};

use super::{EntryKind, ImportResult, ImportedEntry, Importer};

// Alias sets for the generic/browser mapper (headers are lowercased + trimmed).
const TITLE: &[&str] = &["title", "name", "account", "item", "item name"];
const USERNAME: &[&str] = &[
    "username",
    "user",
    "login",
    "login_username",
    "user name",
    "email",
];
const PASSWORD: &[&str] = &["password", "pass", "login_password"];
const URL: &[&str] = &[
    "url",
    "urls",
    "website",
    "uri",
    "login_uri",
    "web site",
    "site",
    "link",
];
const NOTES: &[&str] = &["notes", "note", "extra", "comments", "comment"];
const OTP: &[&str] = &[
    "otp",
    "totp",
    "otpauth",
    "2fa",
    "token",
    "otp secret",
    "totp secret",
];
// Swifty's own columns (see `export::COLUMNS`): no foreign sheet has them.
const TYPE: &[&str] = &["type"];
const BODY: &[&str] = &["body"];
const FILE_NAME: &[&str] = &["file_name"];
const CSV_VERSION: &[&str] = &[super::export::CSV_VERSION_HEADER];

// A parsed sheet: header names (normalized) and the data rows.
struct Rows {
    headers: Vec<String>,
    records: Vec<StringRecord>,
}

// Read CSV into rows, recording (never throwing) header and per-row failures.
fn read_rows(bytes: &[u8], result: &mut ImportResult) -> Option<Rows> {
    let mut rdr = ReaderBuilder::new()
        .flexible(true)
        .has_headers(true)
        .from_reader(bytes);
    let headers = match rdr.headers() {
        Ok(h) => h.iter().map(|s| s.trim().to_lowercase()).collect(),
        Err(e) => {
            result.push_err(0, format!("invalid CSV header: {e}"));
            return None;
        }
    };
    let mut records = Vec::new();
    for (i, rec) in rdr.records().enumerate() {
        match rec {
            Ok(r) => records.push(r),
            Err(e) => result.push_err(i + 2, format!("malformed row: {e}")),
        }
    }
    Some(Rows { headers, records })
}

// First non-empty cell whose header matches one of `aliases`, untrimmed: a
// `.env` file's leading indent and trailing newline are part of the file, and
// the entry promises to hand it back verbatim.
fn get_verbatim(headers: &[String], rec: &StringRecord, aliases: &[&str]) -> Option<String> {
    headers.iter().enumerate().find_map(|(idx, h)| {
        if !aliases.contains(&h.as_str()) {
            return None;
        }
        rec.get(idx).filter(|v| !v.is_empty()).map(String::from)
    })
}

// The same cell, trimmed — what every column but the file wants.
fn get(headers: &[String], rec: &StringRecord, aliases: &[&str]) -> Option<String> {
    get_verbatim(headers, rec, aliases)
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

// Reverse spreadsheet escaping only for a row carrying Swifty's explicit
// format marker. A generic sheet's leading apostrophe is always literal data.
fn decoded(value: Option<String>, swifty: bool) -> Option<String> {
    value.map(|v| {
        if swifty {
            super::export::unsanitize_cell(&v)
        } else {
            v
        }
    })
}

fn get_decoded(
    headers: &[String],
    rec: &StringRecord,
    aliases: &[&str],
    swifty: bool,
) -> Option<String> {
    decoded(get_verbatim(headers, rec, aliases), swifty)
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn tag_vec(group: Option<String>) -> Vec<String> {
    group
        .map(|g| g.trim_start_matches("Root/").trim().to_string())
        .filter(|g| !g.is_empty())
        .map(|g| vec![g])
        .unwrap_or_default()
}

/// Generic CSV mapped by header aliases. Chrome and Safari exports fit the same
/// aliases, so [`BrowserCsv`] just delegates here.
pub struct GenericCsv;

/// Chrome / Safari CSV — same header-aliased shape as generic.
pub struct BrowserCsv;

fn parse_aliased(bytes: &[u8]) -> ImportResult {
    let mut result = ImportResult::default();
    let Some(rows) = read_rows(bytes, &mut result) else {
        return result;
    };
    for (i, rec) in rows.records.iter().enumerate() {
        let swifty =
            get(&rows.headers, rec, CSV_VERSION).as_deref() == Some(super::export::CSV_VERSION);
        let cell = |aliases| get_decoded(&rows.headers, rec, aliases, swifty);
        let title = cell(TITLE).or_else(|| cell(URL)).or_else(|| cell(USERNAME));
        let Some(title) = title else {
            result.push_err(i + 2, "empty row");
            continue;
        };
        // Every row of a foreign sheet is a login, and so is every row of our
        // own that has a login's shape. An `env` row has none — no login column
        // names the file — so it is the one kind the `type` column is read for,
        // or the file would be dropped on the way back in.
        if cell(TYPE).as_deref() == Some(EntryKind::Env.as_str()) {
            result.entries.push(ImportedEntry {
                kind: EntryKind::Env,
                title,
                notes: cell(NOTES),
                env_body: decoded(get_verbatim(&rows.headers, rec, BODY), swifty),
                env_file_name: cell(FILE_NAME),
                ..Default::default()
            });
            continue;
        }
        result.entries.push(ImportedEntry {
            kind: EntryKind::Login,
            title,
            username: cell(USERNAME),
            password: cell(PASSWORD),
            url: cell(URL),
            notes: cell(NOTES),
            otp: cell(OTP),
            ..Default::default()
        });
    }
    result
}

impl Importer for GenericCsv {
    fn parse(&self, bytes: &[u8]) -> ImportResult {
        parse_aliased(bytes)
    }
}

impl Importer for BrowserCsv {
    fn parse(&self, bytes: &[u8]) -> ImportResult {
        parse_aliased(bytes)
    }
}

/// LastPass CSV: `url,username,password,totp,extra,name,grouping,fav`. Secure
/// notes carry the sentinel url `http://sn`.
pub struct LastpassCsv;

impl Importer for LastpassCsv {
    fn parse(&self, bytes: &[u8]) -> ImportResult {
        let mut result = ImportResult::default();
        let Some(rows) = read_rows(bytes, &mut result) else {
            return result;
        };
        for (i, rec) in rows.records.iter().enumerate() {
            let h = &rows.headers;
            let url = get(h, rec, &["url"]);
            let title = get(h, rec, &["name"]).or_else(|| url.clone());
            let Some(title) = title else {
                result.push_err(i + 2, "empty row");
                continue;
            };
            let tags = tag_vec(get(h, rec, &["grouping"]));
            let notes = get(h, rec, &["extra"]);
            if url.as_deref() == Some("http://sn") {
                result.entries.push(ImportedEntry {
                    kind: EntryKind::Note,
                    title,
                    notes,
                    tags,
                    ..Default::default()
                });
            } else {
                result.entries.push(ImportedEntry {
                    kind: EntryKind::Login,
                    title,
                    username: get(h, rec, &["username"]),
                    password: get(h, rec, &["password"]),
                    url,
                    otp: get(h, rec, &["totp"]),
                    notes,
                    tags,
                    ..Default::default()
                });
            }
        }
        result
    }
}

/// KeePassXC CSV: `Group,Title,Username,Password,URL,Notes,TOTP,...`. The Group
/// path becomes a tag (its `Root/` prefix stripped).
pub struct KeepassCsv;

impl Importer for KeepassCsv {
    fn parse(&self, bytes: &[u8]) -> ImportResult {
        let mut result = ImportResult::default();
        let Some(rows) = read_rows(bytes, &mut result) else {
            return result;
        };
        for (i, rec) in rows.records.iter().enumerate() {
            let h = &rows.headers;
            let Some(title) = get(h, rec, &["title"]) else {
                result.push_err(i + 2, "row has no title");
                continue;
            };
            result.entries.push(ImportedEntry {
                kind: EntryKind::Login,
                title,
                username: get(h, rec, &["username"]),
                password: get(h, rec, &["password"]),
                url: get(h, rec, &["url"]),
                notes: get(h, rec, &["notes"]),
                otp: get(h, rec, &["totp"]),
                tags: tag_vec(get(h, rec, &["group"])),
                ..Default::default()
            });
        }
        result
    }
}
