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
const USER_AGENT: &str = "Rowel-Password-Manager";

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
// both ways. Touches no vault state, but the caller gates it on an unlocked
// session all the same (`commands::tools::fetch_favicon`): the hosts come out
// of the vault, and a locked app has no business making requests about them.
// `allowed` is that gate, asked again before every request this makes — a
// lookup is several round trips, and a lock that lands in the middle of one
// ends it there rather than after the icon has been fetched.
pub async fn fetch(
    app: &AppHandle,
    host: &str,
    allowed: impl Fn() -> bool,
) -> Result<Option<String>> {
    let Some(host) = safe_host(host) else {
        return Ok(None);
    };
    let dir = storage::icons_dir(app)?;
    fs::create_dir_all(&dir)?;

    let hit = dir.join(format!("{host}.uri"));
    if let Ok(uri) = fs::read_to_string(&hit) {
        return Ok(Some(uri));
    }
    let miss = dir.join(format!("{host}.miss"));
    if fresh_miss(&miss) {
        return Ok(None);
    }

    match lookup(&host, &allowed).await {
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
// DNS name (no slashes, no traversal, no URL metacharacters). Also refuses
// what a public website is never called: an IP literal, or a name under a
// suffix that only resolves on the local network. An entry's host is the
// user's own data, but a request to `192.168.1.1` or `nas.local` from a
// password manager is a probe of the LAN the user did not ask for, and the
// answer would be cached under the vault's icons for good.
fn safe_host(host: &str) -> Option<String> {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    let ok = !host.is_empty()
        && host.len() <= 253
        && host.contains('.')
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && !is_ip_literal(&host)
        && !LOCAL_SUFFIXES.iter().any(|suffix| host.ends_with(suffix));
    ok.then_some(host)
}

// Suffixes that never name a public site (RFC 6762 `.local`, the reserved
// `.localhost`, `.internal` and `.home.arpa`, and the de-facto `.lan`).
const LOCAL_SUFFIXES: [&str; 5] = [".local", ".localhost", ".internal", ".home.arpa", ".lan"];

// A dotted-quad is the only IP shape that survives the character check above
// (an IPv6 literal has colons).
fn is_ip_literal(host: &str) -> bool {
    host.parse::<std::net::Ipv4Addr>().is_ok()
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
async fn lookup(host: &str, allowed: &impl Fn() -> bool) -> Option<String> {
    let client = client()?;
    let root = Url::parse(&format!("https://{host}/")).ok()?;

    if !allowed() {
        return None;
    }
    if let Some(html) = fetch_html(&client, root.clone()).await {
        for href in icon_hrefs(&html) {
            let Ok(url) = root.join(&href) else { continue };
            if !is_public_https(&url) {
                continue;
            }
            if !allowed() {
                return None;
            }
            if let Some(uri) = fetch_icon(&client, url).await {
                return Some(uri);
            }
        }
    }

    if !allowed() {
        return None;
    }
    fetch_icon(&client, root.join("favicon.ico").ok()?).await
}

// Every URL this module follows — a declared icon's href, a redirect's target
// — has to pass the same bar as the host it started from: HTTPS, to a public
// name. A page can point its icon at a CDN, which is fine; it cannot point it
// at `http://10.0.0.1/` or have a redirect land there.
fn is_public_https(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str().and_then(safe_host).is_some()
}

// The shared deadlines plus a redirect policy: a handful of hops, and only to
// URLs [`is_public_https`] accepts, since a redirect is the one way a fetch
// can end up somewhere the href check never saw.
fn client() -> Option<Client> {
    let policy = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS || !is_public_https(attempt.url()) {
            attempt.stop()
        } else {
            attempt.follow()
        }
    });
    crate::sync::http_client_builder()
        .redirect(policy)
        .build()
        .ok()
}

const MAX_REDIRECTS: usize = 5;

async fn fetch_icon(client: &Client, url: Url) -> Option<String> {
    let mut resp = client
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
    // Enforced on the bytes as they arrive, not just on the declared length: a
    // body with no `Content-Length`, or one that lies, is cut off at the cap
    // rather than buffered whole and then measured.
    let bytes = crate::sync::drive::read_capped(&mut resp, MAX_ICON_BYTES)
        .await
        .ok()?;
    if bytes.is_empty() {
        return None;
    }
    Some(format!("data:{mime};base64,{}", B64.encode(&bytes)))
}

// The first `MAX_HTML_BYTES` of the page. Only the <head> is wanted, so an
// oversized page is truncated rather than refused — and the read stops at the
// cap instead of downloading the rest to throw it away.
async fn fetch_html(client: &Client, url: Url) -> Option<String> {
    let mut resp = client
        .get(url)
        .timeout(TIMEOUT)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let mut bytes = Vec::new();
    while bytes.len() < MAX_HTML_BYTES {
        let Some(chunk) = resp.chunk().await.ok()? else {
            break;
        };
        let room = MAX_HTML_BYTES - bytes.len();
        bytes.extend_from_slice(&chunk[..chunk.len().min(room)]);
    }
    Some(String::from_utf8_lossy(&bytes).into_owned())
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

    // A vault entry can name anything; a favicon fetch may only reach the
    // public internet.
    #[test]
    fn rejects_ip_literals_and_local_only_names() {
        assert_eq!(safe_host("192.168.1.1"), None);
        assert_eq!(safe_host("10.0.0.1"), None);
        assert_eq!(safe_host("8.8.8.8"), None);
        assert_eq!(safe_host("nas.local"), None);
        assert_eq!(safe_host("router.lan"), None);
        assert_eq!(safe_host("db.internal"), None);
        assert_eq!(safe_host("printer.home.arpa"), None);
        assert_eq!(safe_host("app.localhost"), None);
        // A name that merely contains one of the words is still public.
        assert_eq!(
            safe_host("localhost.example.com"),
            Some("localhost.example.com".into())
        );
        assert_eq!(
            safe_host("internal-tools.example.com"),
            Some("internal-tools.example.com".into())
        );
    }

    #[test]
    fn only_public_https_urls_are_followed() {
        let ok = |s: &str| is_public_https(&Url::parse(s).unwrap());
        assert!(ok("https://cdn.example.com/icon.png"));
        assert!(!ok("http://cdn.example.com/icon.png"));
        assert!(!ok("https://10.0.0.1/icon.png"));
        assert!(!ok("https://nas.local/icon.png"));
        assert!(!ok("https://localhost/icon.png"));
    }

    #[test]
    fn finds_declared_icons_apple_touch_first() {
        let html = r#"<head>
            <link rel="stylesheet" href="/app.css">
            <link rel="icon" type="image/png" href="/Icon-32.png">
            <LINK REL="apple-touch-icon" HREF="/touch.png">
            <link rel="shortcut icon" href=favicon.ico >
        </head>"#;
        assert_eq!(
            icon_hrefs(html),
            vec!["/touch.png", "/Icon-32.png", "favicon.ico"]
        );
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
        assert_eq!(
            attr_value(tag, &lower, "href").as_deref(),
            Some("/CaseSensitive.PNG")
        );
    }
}
