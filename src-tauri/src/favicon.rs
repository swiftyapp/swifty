//! Website favicon fetch + on-disk cache, for list-row identity.
//!
//! Privacy: icons are fetched directly from the host an entry already points
//! at — never through a third-party favicon service — so the vault's host
//! list is not shipped anywhere new. Misses are cached with a TTL so offline
//! launches and dead hosts don't retry on every run.
//!
//! The result crosses IPC as a `data:` URI, which keeps the webview CSP's
//! `img-src 'self' data:` intact. Remote SVG is refused outright — an SVG is
//! a script container, not an image.

use std::fs;
use std::path::Path;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use reqwest::Client;
use tauri::AppHandle;
use url::Url;

use crate::error::Result;
use crate::storage;

const MAX_ICON_BYTES: usize = 256 * 1024;
const MAX_HTML_BYTES: usize = 512 * 1024;
const MISS_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const TIMEOUT: Duration = Duration::from_secs(8);
const USER_AGENT: &str = "Swifty-Password-Manager";

// Raster only (see module docs). Octet-stream is deliberately absent: an icon
// we can't type is an icon we don't render.
const SAFE_TYPES: [&str; 6] = [
    "image/png",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/jpeg",
    "image/gif",
    "image/webp",
];

// The favicon for `host` as a data: URI, or None when it has none. Disk-cached
// both ways; safe to call before unlock (touches no vault state).
#[tauri::command]
pub async fn fetch_favicon(app: AppHandle, host: String) -> Result<Option<String>> {
    let Some(host) = safe_host(&host) else {
        return Ok(None);
    };
    let dir = storage::icons_dir(&app)?;
    fs::create_dir_all(&dir)?;

    let hit = dir.join(format!("{host}.uri"));
    if let Ok(uri) = fs::read_to_string(&hit) {
        return Ok(Some(uri));
    }
    let miss = dir.join(format!("{host}.miss"));
    if fresh_miss(&miss) {
        return Ok(None);
    }

    match lookup(&host).await {
        Some(uri) => {
            let _ = fs::write(&hit, &uri);
            let _ = fs::remove_file(&miss);
            Ok(Some(uri))
        }
        None => {
            let _ = fs::write(&miss, b"");
            Ok(None)
        }
    }
}

// Hostnames double as cache file names, so reject anything that isn't a plain
// DNS name (no slashes, no traversal, no URL metacharacters).
fn safe_host(host: &str) -> Option<String> {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    let ok = !host.is_empty()
        && host.len() <= 253
        && host.contains('.')
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
    ok.then_some(host)
}

fn fresh_miss(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|at| at.elapsed().ok())
        .is_some_and(|age| age < MISS_TTL)
}

// Declared icons from the homepage <head> first (usually crisp PNGs), then
// the conventional /favicon.ico as the fallback.
async fn lookup(host: &str) -> Option<String> {
    let client = crate::sync::http_client();
    let root = Url::parse(&format!("https://{host}/")).ok()?;

    if let Some(html) = fetch_html(&client, root.clone()).await {
        for href in icon_hrefs(&html) {
            let Ok(url) = root.join(&href) else { continue };
            if !matches!(url.scheme(), "http" | "https") {
                continue;
            }
            if let Some(uri) = fetch_icon(&client, url).await {
                return Some(uri);
            }
        }
    }

    fetch_icon(&client, root.join("favicon.ico").ok()?).await
}

async fn fetch_icon(client: &Client, url: Url) -> Option<String> {
    let resp = client
        .get(url)
        .timeout(TIMEOUT)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)?
        .to_str()
        .ok()?
        .split(';')
        .next()?
        .trim()
        .to_ascii_lowercase();
    if !SAFE_TYPES.contains(&mime.as_str()) {
        return None;
    }
    if resp
        .content_length()
        .is_some_and(|len| len as usize > MAX_ICON_BYTES)
    {
        return None;
    }
    let bytes = resp.bytes().await.ok()?;
    if bytes.is_empty() || bytes.len() > MAX_ICON_BYTES {
        return None;
    }
    Some(format!("data:{mime};base64,{}", B64.encode(&bytes)))
}

async fn fetch_html(client: &Client, url: Url) -> Option<String> {
    let resp = client
        .get(url)
        .timeout(TIMEOUT)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let bytes = resp.bytes().await.ok()?;
    let cut = bytes.len().min(MAX_HTML_BYTES);
    Some(String::from_utf8_lossy(&bytes[..cut]).into_owned())
}

// hrefs of <link> tags whose rel mentions "icon" ("icon", "shortcut icon",
// "apple-touch-icon"), in document order with apple-touch (largest art)
// hoisted first. A tolerant ASCII scan, not an HTML parser — good enough for
// <head> markup in the wild, and every candidate is still mime-checked.
fn icon_hrefs(html: &str) -> Vec<String> {
    let lower = html.to_ascii_lowercase(); // ASCII transform: byte offsets align
    let mut ranked: Vec<(u8, String)> = Vec::new();
    let mut at = 0;
    while let Some(found) = lower[at..].find("<link") {
        let start = at + found;
        let Some(len) = lower[start..].find('>') else {
            break;
        };
        let end = start + len;
        let (tag, tag_lower) = (&html[start..end], &lower[start..end]);
        at = end + 1;

        let rel = attr_value(tag_lower, tag_lower, "rel").unwrap_or_default();
        if !rel.split_whitespace().any(|word| word.contains("icon")) {
            continue;
        }
        if let Some(href) = attr_value(tag, tag_lower, "href") {
            let rank = u8::from(!rel.contains("apple-touch"));
            ranked.push((rank, href));
        }
    }
    ranked.sort_by_key(|(rank, _)| *rank);
    ranked.into_iter().map(|(_, href)| href).collect()
}

// The value of `name="..."` in a tag. Matched case-insensitively against
// `tag_lower`; the value is sliced out of `tag` so its case survives.
fn attr_value(tag: &str, tag_lower: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=");
    let value_at = tag_lower.find(&needle)? + needle.len();
    let rest = &tag[value_at..];
    let (rest, quote) = match rest.chars().next()? {
        q @ ('"' | '\'') => (&rest[1..], Some(q)),
        _ => (rest, None),
    };
    let end = match quote {
        Some(q) => rest.find(q)?,
        None => rest
            .find(|c: char| c.is_whitespace() || c == '>')
            .unwrap_or(rest.len()),
    };
    let value = rest[..end].trim();
    (!value.is_empty()).then(|| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_hosts_and_rejects_everything_else() {
        assert_eq!(safe_host("Mail.Google.com"), Some("mail.google.com".into()));
        assert_eq!(safe_host("github.com."), Some("github.com".into()));
        assert_eq!(safe_host("localhost"), None); // no dot
        assert_eq!(safe_host("evil.com/../../vault"), None);
        assert_eq!(safe_host("host with space.com"), None);
        assert_eq!(safe_host(""), None);
    }

    #[test]
    fn finds_declared_icons_apple_touch_first() {
        let html = r#"<head>
            <link rel="stylesheet" href="/app.css">
            <link rel="icon" type="image/png" href="/Icon-32.png">
            <LINK REL="apple-touch-icon" HREF="/touch.png">
            <link rel="shortcut icon" href=favicon.ico >
        </head>"#;
        assert_eq!(icon_hrefs(html), vec!["/touch.png", "/Icon-32.png", "favicon.ico"]);
    }

    #[test]
    fn ignores_links_without_icon_rel_or_href() {
        let html = r#"<link rel="preload" href="/x.woff2"><link rel="icon">"#;
        assert!(icon_hrefs(html).is_empty());
    }

    #[test]
    fn attr_values_keep_their_case() {
        let tag = r#"<link rel="icon" href="/CaseSensitive.PNG""#;
        let lower = tag.to_ascii_lowercase();
        assert_eq!(attr_value(tag, &lower, "href").as_deref(), Some("/CaseSensitive.PNG"));
    }
}
