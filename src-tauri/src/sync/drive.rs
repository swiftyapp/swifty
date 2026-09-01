//! Drive v3 REST surface. All calls are authorized with a bearer access token.
//! Query values are escaped and passed as parameters rather than
//! string-concatenated (fixes the legacy `q` injection).
//!
//! Bodies are **bytes**, not strings: the artifact this module moves is a
//! `.swsync` pack — SQLCipher ciphertext with a binary header — and routing it
//! through `String` would either corrupt it or fail to decode.

use reqwest::Client;
use serde_json::{json, Value};

use crate::error::{Error, Result};

const FILES: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
// `createdTime` drives the deterministic pick below; `headRevisionId` is the
// change token the engine uses to detect a push that landed under it.
const LIST_FIELDS: &str = "files(id, name, createdTime, headRevisionId)";
const FILE_FIELDS: &str = "id, createdTime, headRevisionId";
const FILE_MIME: &str = "application/octet-stream";
const FOLDER_MIME: &str = "application/vnd.google-apps.folder";

/// One Drive object, with the two fields selection and race detection need.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DriveFile {
    pub id: String,
    pub created_time: String,
    /// Absent on folders, and on a file Drive has not yet assigned a revision
    /// to. The engine treats an absent revision as "unknown", which only costs
    /// it a race check, never correctness.
    pub head_revision: Option<String>,
}

fn other<E: std::fmt::Display>(e: E) -> Error {
    Error::Other(e.to_string())
}

// Escape a value for use inside a Drive `q` string literal (`name = '...'`).
fn escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}

async fn check(resp: reqwest::Response) -> Result<Value> {
    let status = resp.status();
    let body = resp.text().await.map_err(other)?;
    if !status.is_success() {
        return Err(Error::Other(format!("Drive API {status}: {body}")));
    }
    if body.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&body).map_err(other)
}

// Run a files.list query and return *every* match.
async fn find_all(client: &Client, token: &str, q: &str) -> Result<Vec<DriveFile>> {
    let resp = client
        .get(FILES)
        .bearer_auth(token)
        .query(&[("q", q), ("fields", LIST_FIELDS)])
        .send()
        .await
        .map_err(other)?;
    let data = check(resp).await?;
    Ok(data["files"]
        .as_array()
        .map(|files| files.iter().filter_map(parse_file).collect())
        .unwrap_or_default())
}

fn parse_file(value: &Value) -> Option<DriveFile> {
    Some(DriveFile {
        id: value["id"].as_str()?.to_string(),
        created_time: value["createdTime"].as_str().unwrap_or("").to_string(),
        head_revision: value["headRevisionId"].as_str().map(String::from),
    })
}

/// The oldest match, `id` breaking an exact tie.
///
/// Drive permits same-name siblings and `files.list` guarantees no particular
/// order, so "take the first result" let two devices settle on *different*
/// folders or vault files and sync past each other forever — a split brain that
/// looks exactly like sync silently not working. Oldest-first is the one rule
/// every device can evaluate identically: whichever file the pair created
/// first is the one they both keep using, and a duplicate created later is
/// simply ignored (the merge self-heals whatever landed in it once a device
/// pulls it, and nothing is lost meanwhile because pushes are full-state).
///
/// `createdTime` is RFC 3339 UTC from Drive, a fixed-width format in which
/// lexicographic order *is* chronological order — no date parsing needed.
fn oldest(files: Vec<DriveFile>) -> Option<DriveFile> {
    files.into_iter().min_by(|a, b| {
        a.created_time
            .cmp(&b.created_time)
            .then_with(|| a.id.cmp(&b.id))
    })
}

pub async fn folder_id(client: &Client, token: &str, name: &str) -> Result<Option<String>> {
    let q = format!(
        "name = '{}' and mimeType = '{FOLDER_MIME}' and trashed = false",
        escape(name)
    );
    Ok(oldest(find_all(client, token, &q).await?).map(|f| f.id))
}

pub async fn find_file(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
) -> Result<Option<DriveFile>> {
    let q = format!(
        "name = '{}' and trashed = false and '{}' in parents",
        escape(name),
        escape(parent)
    );
    Ok(oldest(find_all(client, token, &q).await?))
}

/// The file's current head revision, read fresh (the engine's pre-flight check).
pub async fn head_revision(client: &Client, token: &str, id: &str) -> Result<Option<String>> {
    let resp = client
        .get(format!("{FILES}/{id}"))
        .bearer_auth(token)
        .query(&[("fields", FILE_FIELDS)])
        .send()
        .await
        .map_err(other)?;
    Ok(check(resp)
        .await?
        .get("headRevisionId")
        .and_then(Value::as_str)
        .map(String::from))
}

pub async fn read_file(client: &Client, token: &str, id: &str) -> Result<Vec<u8>> {
    let resp = client
        .get(format!("{FILES}/{id}"))
        .bearer_auth(token)
        .query(&[("alt", "media")])
        .send()
        .await
        .map_err(other)?;
    let status = resp.status();
    let body = resp.bytes().await.map_err(other)?;
    if !status.is_success() {
        return Err(Error::Other(format!(
            "Drive API {status}: {}",
            String::from_utf8_lossy(&body)
        )));
    }
    Ok(body.to_vec())
}

pub async fn create_folder(client: &Client, token: &str, name: &str) -> Result<String> {
    let resp = client
        .post(FILES)
        .bearer_auth(token)
        .json(&json!({ "name": name, "mimeType": FOLDER_MIME }))
        .send()
        .await
        .map_err(other)?;
    let data = check(resp).await?;
    data["id"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| Error::Other("Drive API returned no id".into()))
}

/// multipart/related upload: a JSON metadata part, then the raw pack bytes.
///
/// The envelope is assembled by hand because the body is binary — it is spliced
/// in between UTF-8 boundary lines rather than formatted into a `String`.
pub async fn create_file(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
    content: &[u8],
) -> Result<DriveFile> {
    let metadata = json!({ "name": name, "mimeType": FILE_MIME, "parents": [parent] });
    let boundary = "swifty-boundary";
    let head = format!(
        "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n\
         --{boundary}\r\nContent-Type: {FILE_MIME}\r\n\r\n"
    );
    let tail = format!("\r\n--{boundary}--");

    let mut body = Vec::with_capacity(head.len() + content.len() + tail.len());
    body.extend_from_slice(head.as_bytes());
    body.extend_from_slice(content);
    body.extend_from_slice(tail.as_bytes());

    let resp = client
        .post(UPLOAD)
        .bearer_auth(token)
        .query(&[("uploadType", "multipart"), ("fields", FILE_FIELDS)])
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .await
        .map_err(other)?;
    parse_file(&check(resp).await?).ok_or_else(|| Error::Other("Drive API returned no id".into()))
}

/// Overwrite a file's content, returning its new head revision.
pub async fn update_file(
    client: &Client,
    token: &str,
    id: &str,
    content: &[u8],
) -> Result<Option<String>> {
    let resp = client
        .patch(format!("{UPLOAD}/{id}"))
        .bearer_auth(token)
        .query(&[("uploadType", "media"), ("fields", FILE_FIELDS)])
        .header(reqwest::header::CONTENT_TYPE, FILE_MIME)
        .body(content.to_vec())
        .send()
        .await
        .map_err(other)?;
    Ok(check(resp)
        .await?
        .get("headRevisionId")
        .and_then(Value::as_str)
        .map(String::from))
}

#[cfg(test)]
mod tests {
    use super::{escape, oldest, DriveFile};

    #[test]
    fn escapes_quotes_and_backslashes() {
        assert_eq!(escape("Swifty"), "Swifty");
        assert_eq!(escape("a'b"), "a\\'b");
        assert_eq!(escape("a\\b"), "a\\\\b");
        // A name crafted to break out of the literal stays contained.
        assert_eq!(escape("x' or '1'='1"), "x\\' or \\'1\\'=\\'1");
    }

    fn file(id: &str, created: &str) -> DriveFile {
        DriveFile {
            id: id.into(),
            created_time: created.into(),
            head_revision: None,
        }
    }

    #[test]
    fn oldest_wins_whatever_order_drive_lists_in() {
        let old = file("old", "2023-01-01T00:00:00.000Z");
        let new = file("new", "2024-06-01T00:00:00.000Z");

        assert_eq!(oldest(vec![new.clone(), old.clone()]), Some(old.clone()));
        assert_eq!(oldest(vec![old.clone(), new]), Some(old));
    }

    #[test]
    fn an_exact_created_time_tie_is_broken_by_id() {
        let a = file("aaa", "2024-01-01T00:00:00.000Z");
        let b = file("bbb", "2024-01-01T00:00:00.000Z");
        assert_eq!(oldest(vec![b.clone(), a.clone()]), Some(a.clone()));
        assert_eq!(oldest(vec![a, b]).unwrap().id, "aaa");
    }

    #[test]
    fn no_matches_selects_nothing() {
        assert_eq!(oldest(vec![]), None);
    }
}
