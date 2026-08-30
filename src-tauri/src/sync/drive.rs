//! Drive v3 REST surface (port of legacy `gdrive/drive.js`). All calls are
//! authorized with a bearer access token. Query values are escaped and passed as
//! parameters rather than string-concatenated (fixes the legacy `q` injection).

use reqwest::Client;
use serde_json::{json, Value};

use crate::error::{Error, Result};

const FILES: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
const FIELDS: &str = "files(id, name)";
const FILE_MIME: &str = "application/vnd.swftx";
const FOLDER_MIME: &str = "application/vnd.google-apps.folder";

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

// Run a files.list query and return the first matching id, if any.
async fn find_one(client: &Client, token: &str, q: &str) -> Result<Option<String>> {
    let resp = client
        .get(FILES)
        .bearer_auth(token)
        .query(&[("q", q), ("fields", FIELDS)])
        .send()
        .await
        .map_err(other)?;
    let data = check(resp).await?;
    Ok(data["files"]
        .as_array()
        .and_then(|f| f.first())
        .and_then(|f| f["id"].as_str())
        .map(String::from))
}

pub async fn folder_id(client: &Client, token: &str, name: &str) -> Result<Option<String>> {
    find_one(client, token, &format!("name = '{}' and trashed = false", escape(name))).await
}

pub async fn file_id(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
) -> Result<Option<String>> {
    let q = format!(
        "name = '{}' and trashed = false and '{}' in parents",
        escape(name),
        escape(parent)
    );
    find_one(client, token, &q).await
}

pub async fn read_file(client: &Client, token: &str, id: &str) -> Result<String> {
    let resp = client
        .get(format!("{FILES}/{id}"))
        .bearer_auth(token)
        .query(&[("alt", "media")])
        .send()
        .await
        .map_err(other)?;
    let status = resp.status();
    let body = resp.text().await.map_err(other)?;
    if !status.is_success() {
        return Err(Error::Other(format!("Drive API {status}: {body}")));
    }
    Ok(body)
}

pub async fn create_folder(client: &Client, token: &str, name: &str) -> Result<String> {
    let resp = client
        .post(FILES)
        .bearer_auth(token)
        .json(&json!({ "name": name, "mimeType": FOLDER_MIME }))
        .send()
        .await
        .map_err(other)?;
    id_of(check(resp).await?)
}

// multipart/related upload: JSON metadata part + file content part.
pub async fn create_file(
    client: &Client,
    token: &str,
    name: &str,
    parent: &str,
    content: &str,
) -> Result<String> {
    let metadata = json!({ "name": name, "mimeType": FILE_MIME, "parents": [parent] });
    let boundary = "swifty-boundary";
    let body = format!(
        "--{b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n\
         --{b}\r\nContent-Type: {mime}\r\n\r\n{content}\r\n--{b}--",
        b = boundary,
        meta = metadata,
        mime = FILE_MIME,
    );
    let resp = client
        .post(UPLOAD)
        .bearer_auth(token)
        .query(&[("uploadType", "multipart")])
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .await
        .map_err(other)?;
    id_of(check(resp).await?)
}

pub async fn update_file(client: &Client, token: &str, id: &str, content: &str) -> Result<()> {
    let resp = client
        .patch(format!("{UPLOAD}/{id}"))
        .bearer_auth(token)
        .query(&[("uploadType", "media")])
        .header(reqwest::header::CONTENT_TYPE, FILE_MIME)
        .body(content.to_string())
        .send()
        .await
        .map_err(other)?;
    check(resp).await?;
    Ok(())
}

fn id_of(data: Value) -> Result<String> {
    data["id"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| Error::Other("Drive API returned no id".into()))
}

#[cfg(test)]
mod tests {
    use super::escape;

    #[test]
    fn escapes_quotes_and_backslashes() {
        assert_eq!(escape("Swifty"), "Swifty");
        assert_eq!(escape("a'b"), "a\\'b");
        assert_eq!(escape("a\\b"), "a\\\\b");
        // A name crafted to break out of the literal stays contained.
        assert_eq!(escape("x' or '1'='1"), "x\\' or \\'1\\'=\\'1");
    }
}
