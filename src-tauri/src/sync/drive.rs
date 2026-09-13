//! Drive v3 REST surface. All calls are authorized with a bearer access token.
//! Query values are escaped and passed as parameters rather than
//! string-concatenated (fixes the legacy `q` injection).
//!
//! Bodies are **bytes**, not strings: the artifact this module moves is a
//! `.swsync` pack — SQLCipher ciphertext with a binary header — and routing it
//! through `String` would either corrupt it or fail to decode.

use std::collections::BTreeMap;

use reqwest::Client;
use serde_json::{json, Value};

use crate::error::{Error, Result};

const FILES: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
// `createdTime` drives the deterministic pick below; `headRevisionId` is the
// change token the engine uses to detect a push that landed under it.
const LIST_FIELDS: &str = "files(id, name, createdTime, headRevisionId, appProperties)";
const FILE_FIELDS: &str = "id, name, createdTime, headRevisionId, appProperties";
const FILE_MIME: &str = "application/octet-stream";
const FOLDER_MIME: &str = "application/vnd.google-apps.folder";

/// One Drive object, with the fields selection and race detection need.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DriveFile {
    pub id: String,
    pub name: String,
    pub created_time: String,
    /// Absent on folders, and on a file Drive has not yet assigned a revision
    /// to. The engine treats an absent revision as "unknown", which only costs
    /// it a race check, never correctness.
    pub head_revision: Option<String>,
    /// `appProperties`: private per-file metadata, visible only to this OAuth
    /// client. Sharing stores its bookkeeping (entry id, kind, expiry) here so
    /// a listing alone answers what a share is, without downloading it.
    pub app_properties: BTreeMap<String, String>,
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
    // Drive pages the listing whenever it likes, not only past `pageSize`, so
    // one request is never the whole answer: a share left on a later page would
    // be invisible to both the sweep and the revoke list.
    let mut files = Vec::new();
    let mut page_token: Option<String> = None;
    loop {
        let mut query = vec![("q", q), ("fields", LIST_FIELDS), ("pageSize", "100")];
        if let Some(token) = &page_token {
            query.push(("pageToken", token));
        }
        let resp = client
            .get(FILES)
            .bearer_auth(token)
            .query(&query)
            .send()
            .await
            .map_err(other)?;
        let (page, next) = parse_listing(&check(resp).await?);
        files.extend(page);
        match next {
            Some(next) => page_token = Some(next),
            None => return Ok(files),
        }
    }
}

/// One page of a `files.list` response: its files and the token for the next
/// page, if Drive says there is one.
fn parse_listing(data: &Value) -> (Vec<DriveFile>, Option<String>) {
    let files = data["files"]
        .as_array()
        .map(|files| files.iter().filter_map(parse_file).collect())
        .unwrap_or_default();
    let next = data["nextPageToken"]
        .as_str()
        .filter(|t| !t.is_empty())
        .map(String::from);
    (files, next)
}

fn parse_file(value: &Value) -> Option<DriveFile> {
    Some(DriveFile {
        id: value["id"].as_str()?.to_string(),
        name: value["name"].as_str().unwrap_or("").to_string(),
        created_time: value["createdTime"].as_str().unwrap_or("").to_string(),
        head_revision: value["headRevisionId"].as_str().map(String::from),
        app_properties: parse_properties(&value["appProperties"]),
    })
}

// Drive declares appProperties as string->string, but a value that is not a
// string is simply dropped rather than stringified: a caller reading one back
// expects what it wrote, and `"1"` and `1` are not the same key to it.
fn parse_properties(value: &Value) -> BTreeMap<String, String> {
    value
        .as_object()
        .map(|map| {
            map.iter()
                .filter_map(|(k, v)| Some((k.clone(), v.as_str()?.to_string())))
                .collect()
        })
        .unwrap_or_default()
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

/// [`folder_id`], scoped to one parent — the same oldest-wins rule, so two
/// devices racing to create the same subfolder still settle on one.
pub async fn folder_id_in(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
) -> Result<Option<String>> {
    let q = format!(
        "name = '{}' and mimeType = '{FOLDER_MIME}' and trashed = false and '{}' in parents",
        escape(name),
        escape(parent)
    );
    Ok(oldest(find_all(client, token, &q).await?).map(|f| f.id))
}

/// Every non-trashed file this app can see that carries `key = value` in its
/// `appProperties`, wherever it sits. Addressing by marker rather than by
/// folder is what makes a listing complete when two devices raced to create
/// the same folder and each uploaded into its own.
pub async fn find_by_app_property(
    client: &Client,
    token: &str,
    key: &str,
    value: &str,
) -> Result<Vec<DriveFile>> {
    let q = format!(
        "appProperties has {{ key='{}' and value='{}' }} and trashed = false",
        escape(key),
        escape(value)
    );
    find_all(client, token, &q).await
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

/// A folder in the account root.
pub async fn create_folder(client: &Client, token: &str, name: &str) -> Result<String> {
    create_folder_in(client, token, name, None).await
}

/// A folder, optionally inside `parent`.
pub async fn create_folder_in(
    client: &Client,
    token: &str,
    name: &str,
    parent: Option<&str>,
) -> Result<String> {
    let mut metadata = json!({ "name": name, "mimeType": FOLDER_MIME });
    if let Some(parent) = parent {
        metadata["parents"] = json!([parent]);
    }
    let resp = client
        .post(FILES)
        .bearer_auth(token)
        .json(&metadata)
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
pub async fn create_file(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
    content: &[u8],
) -> Result<DriveFile> {
    create_file_with_properties(client, token, name, parent, content, &[]).await
}

/// [`create_file`] plus `appProperties` — private metadata the listing carries
/// back, so a caller can tell its files apart without downloading them.
pub async fn create_file_with_properties(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
    content: &[u8],
    properties: &[(&str, &str)],
) -> Result<DriveFile> {
    let mut metadata = json!({ "name": name, "mimeType": FILE_MIME, "parents": [parent] });
    if !properties.is_empty() {
        metadata["appProperties"] = properties
            .iter()
            .map(|(k, v)| ((*k).to_string(), Value::from(*v)))
            .collect::<serde_json::Map<_, _>>()
            .into();
    }

    let resp = client
        .post(UPLOAD)
        .bearer_auth(token)
        .query(&[("uploadType", "multipart"), ("fields", FILE_FIELDS)])
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/related; boundary={BOUNDARY}"),
        )
        .body(multipart_body(&metadata, content))
        .send()
        .await
        .map_err(other)?;
    parse_file(&check(resp).await?).ok_or_else(|| Error::Other("Drive API returned no id".into()))
}

const BOUNDARY: &str = "swifty-boundary";

/// The envelope is assembled by hand because the body is binary — it is spliced
/// in between UTF-8 boundary lines rather than formatted into a `String`.
fn multipart_body(metadata: &Value, content: &[u8]) -> Vec<u8> {
    let head = format!(
        "--{BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n\
         --{BOUNDARY}\r\nContent-Type: {FILE_MIME}\r\n\r\n"
    );
    let tail = format!("\r\n--{BOUNDARY}--");

    let mut body = Vec::with_capacity(head.len() + content.len() + tail.len());
    body.extend_from_slice(head.as_bytes());
    body.extend_from_slice(content);
    body.extend_from_slice(tail.as_bytes());
    body
}

/// Grant read access to anyone holding the file's id — what turns an uploaded
/// share into a link the recipient can fetch without a Google account.
///
/// The bytes are sealed before they are uploaded, so "anyone with the link" is
/// only as open as the key the sender hands over out of band.
pub async fn share_with_anyone(client: &Client, token: &str, id: &str) -> Result<()> {
    let resp = client
        .post(format!("{FILES}/{id}/permissions"))
        .bearer_auth(token)
        .json(&json!({ "type": "anyone", "role": "reader" }))
        .send()
        .await
        .map_err(other)?;
    check(resp).await.map(|_| ())
}

/// Delete a file. Already gone counts as deleted — that is the state the caller
/// asked for, and revoke/sweep both race other devices doing the same thing.
pub async fn delete_file(client: &Client, token: &str, id: &str) -> Result<()> {
    let resp = client
        .delete(format!("{FILES}/{id}"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(other)?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(());
    }
    check(resp).await.map(|_| ())
}

/// What a recipient is told when the file behind their link is gone. Shared so
/// the test doubles in `share::remote` fail the same way the real client does.
pub(crate) const SHARE_GONE: &str = "this share has expired or was revoked";

/// Download a link-shared file with only an API key — the recipient side, which
/// has no Google account and therefore no bearer token. The key identifies the
/// calling project for quota; it grants nothing on its own.
pub(crate) const SHARE_TOO_LARGE: &str = "this share is larger than Swifty allows";

/// Fetch a link-shared file with no account, refusing anything over
/// `max_bytes`.
///
/// The id comes out of a pasted link, so it can name any public Drive file at
/// all — the cap is checked against the declared length first and then
/// enforced while streaming, so a body that lies about its size still cannot
/// be buffered whole before the ciphertext is even looked at.
pub async fn download_public(
    client: &Client,
    api_key: &str,
    id: &str,
    max_bytes: usize,
) -> Result<Vec<u8>> {
    let mut resp = client
        .get(format!("{FILES}/{id}"))
        .query(&[("alt", "media"), ("key", api_key)])
        .send()
        .await
        .map_err(other)?;
    let status = resp.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        // The only two ways a share the recipient was given disappears, and
        // Drive cannot tell them apart — nor could the recipient act on the
        // difference.
        return Err(Error::Other(SHARE_GONE.into()));
    }
    if !status.is_success() {
        let body = read_capped(&mut resp, max_bytes).await.unwrap_or_default();
        return Err(Error::Other(format!(
            "Drive API {status}: {}",
            String::from_utf8_lossy(&body)
        )));
    }
    if resp
        .content_length()
        .is_some_and(|len| len > max_bytes as u64)
    {
        return Err(Error::Other(SHARE_TOO_LARGE.into()));
    }
    read_capped(&mut resp, max_bytes).await
}

async fn read_capped(resp: &mut reqwest::Response, max_bytes: usize) -> Result<Vec<u8>> {
    let mut body = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(other)? {
        if body.len() + chunk.len() > max_bytes {
            return Err(Error::Other(SHARE_TOO_LARGE.into()));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
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
    use super::{
        escape, multipart_body, oldest, parse_file, parse_listing, parse_properties, DriveFile,
    };
    use serde_json::json;

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
            name: String::new(),
            created_time: created.into(),
            head_revision: None,
            app_properties: Default::default(),
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
    fn a_listing_page_yields_its_files_and_the_next_token() {
        let (files, next) = parse_listing(&serde_json::json!({
            "nextPageToken": "page-2",
            "files": [{"id": "a", "createdTime": "2024-01-01T00:00:00.000Z"}]
        }));
        assert_eq!(files.len(), 1);
        assert_eq!(next.as_deref(), Some("page-2"));

        let (files, next) = parse_listing(&serde_json::json!({"files": []}));
        assert!(files.is_empty());
        assert_eq!(next, None);

        // An empty token is Drive's way of saying "last page" too.
        let (_, next) = parse_listing(&serde_json::json!({"nextPageToken": "", "files": []}));
        assert_eq!(next, None);
    }

    #[test]
    fn no_matches_selects_nothing() {
        assert_eq!(oldest(vec![]), None);
    }

    #[test]
    fn a_listed_file_carries_its_name_and_properties() {
        let parsed = parse_file(&json!({
            "id": "f1",
            "name": "share-1.swshare",
            "createdTime": "2024-01-01T00:00:00.000Z",
            "headRevisionId": "r1",
            "appProperties": { "kind": "login", "expiresAt": "1700000000000" },
        }))
        .unwrap();

        assert_eq!(parsed.name, "share-1.swshare");
        assert_eq!(parsed.app_properties["kind"], "login");
        assert_eq!(parsed.app_properties["expiresAt"], "1700000000000");
        assert_eq!(parsed.head_revision.as_deref(), Some("r1"));
    }

    // The sync engine selects neither field, so every existing caller still
    // parses — it just reads them as empty.
    #[test]
    fn a_file_without_name_or_properties_still_parses() {
        let parsed = parse_file(&json!({ "id": "f1" })).unwrap();
        assert_eq!(parsed.name, "");
        assert!(parsed.app_properties.is_empty());
    }

    #[test]
    fn non_string_property_values_are_dropped() {
        let props = parse_properties(&json!({ "kind": "login", "count": 3, "on": true }));
        assert_eq!(props.len(), 1);
        assert_eq!(props["kind"], "login");
    }

    #[test]
    fn no_properties_object_is_no_properties() {
        assert!(parse_properties(&json!(null)).is_empty());
        assert!(parse_properties(&json!("nonsense")).is_empty());
    }

    // Binary content must survive the envelope byte for byte — the share is
    // ciphertext, and a lossy round trip through `String` would corrupt it.
    #[test]
    fn the_upload_envelope_splices_raw_bytes_between_the_boundaries() {
        let content = [0x00u8, 0xff, 0x1a, b'\r', b'\n'];
        let body = multipart_body(&json!({ "name": "x" }), &content);

        let text = String::from_utf8_lossy(&body);
        assert!(text.starts_with("--swifty-boundary\r\n"));
        assert!(text.contains("{\"name\":\"x\"}"));
        assert!(body.ends_with(b"\r\n--swifty-boundary--"));
        assert!(body.windows(content.len()).any(|w| w == content));
    }
}
