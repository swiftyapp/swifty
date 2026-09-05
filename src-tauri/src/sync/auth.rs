//! Google OAuth2 with PKCE (port of `gdrive/auth.js`), in two shapes.
//!
//! Desktop talks to a Desktop-app client: the consent URL opens in the browser
//! and a one-shot loopback listener on 127.0.0.1 captures the auth code, so the
//! whole flow is one blocking call.
//!
//! iOS talks to an iOS client, which is public (no secret, PKCE mandatory) and
//! is registered against a redirect URI on its own URL scheme. Safari takes the
//! screen and the app is suspended behind it, so the flow has to be cut in half
//! — [`begin`] opens the consent page, [`complete`] runs when iOS reopens the
//! app with the redirect. Everything between the two (the PKCE pair, the auth
//! URL, the token exchange, the token file) is shared.
//!
//! Every request carries a random `state` that the redirect has to echo back
//! ([`parse_redirect`]). On desktop that is belt-and-braces over a loopback port
//! only this process listens on; on iOS it is the whole defence — any app can
//! open a URL on our scheme, and without the nonce one could pass off a stray
//! URL as Google's answer to a flow it never saw.
//!
//! Tokens are stored encrypted via the vault cryptor either way.

#[cfg(desktop)]
use std::io::{BufRead, BufReader, Write};
#[cfg(desktop)]
use std::net::TcpListener;
#[cfg(desktop)]
use std::time::Duration;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use url::Url;

#[cfg(desktop)]
use crate::app::APP_NAME;
use crate::error::{Error, Result};
use crate::{crypto::Cryptor, storage};

#[cfg(desktop)]
const HOST: &str = "127.0.0.1";
#[cfg(desktop)]
const PORT: u16 = 4567;
#[cfg(desktop)]
const CALLBACK: &str = "/auth/callback";
const SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

// Supply your own Google OAuth client at build or run time.
const CLIENT_ID_PLACEHOLDER: &str = "YOUR_GOOGLE_OAUTH_CLIENT_ID";

/// A Google iOS client is addressed by its *reversed* client id, which is also
/// the URL scheme the app registers: client id `123-abc.apps.googleusercontent
/// .com` <-> scheme `com.googleusercontent.apps.123-abc`.
#[cfg(any(mobile, test))]
const IOS_SCHEME_PREFIX: &str = "com.googleusercontent.apps.";
#[cfg(any(mobile, test))]
const IOS_CLIENT_ID_SUFFIX: &str = ".apps.googleusercontent.com";
/// One slash, not two: a reversed-client-id scheme has no authority for a
/// second one to separate. This is the exact string Google registers.
#[cfg(any(mobile, test))]
const IOS_REDIRECT_PATH: &str = ":/oauth2redirect";

/// What a redirect URL turned out to be, once checked against the request that
/// is waiting for one.
#[derive(Debug, PartialEq, Eq)]
pub enum Redirect {
    /// Google's answer to *our* request: the code to exchange.
    Code(String),
    /// Google's answer to our request, and the answer was no (or nothing).
    Denied(String),
    /// Not an answer to our request at all: the `state` is missing or belongs
    /// to some other flow. Whatever is pending must not be touched on its
    /// account.
    Foreign,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Tokens {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

fn other<E: std::fmt::Display>(e: E) -> Error {
    Error::Other(e.to_string())
}

// --- which client this build talks to ---

/// The OAuth client and redirect this platform uses. Resolved per call rather
/// than cached: it is three string reads, and a cache would only add a way for
/// the two halves of the mobile flow to disagree.
struct Credentials {
    client_id: String,
    redirect_uri: String,
    /// Desktop clients ship a (non-confidential) secret. An iOS client is a
    /// public client and must never send one, so this stays `None` there.
    secret: Option<String>,
}

fn env_client_id() -> Option<String> {
    std::env::var("GOOGLE_OAUTH_CLIENT_ID")
        .ok()
        .or_else(|| option_env!("GOOGLE_OAUTH_CLIENT_ID").map(String::from))
        .filter(|id| !id.is_empty() && id != CLIENT_ID_PLACEHOLDER)
}

fn no_client() -> Error {
    Error::Other("Google OAuth client not configured; set GOOGLE_OAUTH_CLIENT_ID".into())
}

#[cfg(desktop)]
impl Credentials {
    fn resolve(_app: &AppHandle) -> Result<Self> {
        Ok(Self {
            client_id: env_client_id().ok_or_else(no_client)?,
            redirect_uri: format!("http://{HOST}:{PORT}{CALLBACK}"),
            secret: std::env::var("GOOGLE_OAUTH_CLIENT_SECRET")
                .ok()
                .or_else(|| option_env!("GOOGLE_OAUTH_CLIENT_SECRET").map(String::from))
                .filter(|s| !s.is_empty()),
        })
    }
}

#[cfg(mobile)]
impl Credentials {
    /// The committed deep-link scheme is the source of truth (iOS client ids
    /// are public, and the scheme is what actually registers the app for the
    /// redirect). `GOOGLE_OAUTH_CLIENT_ID` overrides it for a build that is
    /// given the id from a secret — and the redirect is then derived back from
    /// that same id, so the two can never disagree at runtime.
    fn resolve(app: &AppHandle) -> Result<Self> {
        let client_id = match env_client_id() {
            Some(id) => id,
            None => client_id_from_scheme(&deep_link_scheme(app)?).ok_or_else(no_client)?,
        };
        let scheme = scheme_from_client_id(&client_id).ok_or_else(no_client)?;
        Ok(Self {
            redirect_uri: format!("{scheme}{IOS_REDIRECT_PATH}"),
            client_id,
            secret: None,
        })
    }
}

/// `com.googleusercontent.apps.123-abc` -> `123-abc.apps.googleusercontent.com`
#[cfg(any(mobile, test))]
fn client_id_from_scheme(scheme: &str) -> Option<String> {
    let id = scheme.strip_prefix(IOS_SCHEME_PREFIX)?;
    (!id.is_empty()).then(|| format!("{id}{IOS_CLIENT_ID_SUFFIX}"))
}

/// The inverse of [`client_id_from_scheme`].
#[cfg(any(mobile, test))]
fn scheme_from_client_id(client_id: &str) -> Option<String> {
    let id = client_id.strip_suffix(IOS_CLIENT_ID_SUFFIX)?;
    (!id.is_empty()).then(|| format!("{IOS_SCHEME_PREFIX}{id}"))
}

/// The reversed-client-id scheme out of `plugins.deep-link.mobile` (see
/// `tauri.ios.conf.json`). Other schemes may be configured for other purposes,
/// so this picks the one that looks like a Google client rather than the first.
#[cfg(mobile)]
fn deep_link_scheme(app: &AppHandle) -> Result<String> {
    app.config()
        .plugins
        .0
        .get("deep-link")
        .and_then(|c| c.get("mobile")?.as_array())
        .and_then(|domains| {
            domains.iter().find_map(|d| {
                d.get("scheme")?
                    .as_array()?
                    .iter()
                    .filter_map(|s| s.as_str())
                    .find(|s| s.starts_with(IOS_SCHEME_PREFIX))
                    .map(str::to_owned)
            })
        })
        .ok_or_else(no_client)
}

/// Whether a deep link is *this build's* OAuth redirect — the configured
/// scheme and path exactly — rather than some other URL the app was opened
/// with. Says nothing about which request it answers; [`parse_redirect`] does.
#[cfg(mobile)]
pub fn redirect_matches(app: &AppHandle, url: &Url) -> bool {
    Credentials::resolve(app).is_ok_and(|c| matches_redirect_uri(url, &c.redirect_uri))
}

/// `url` is `redirect_uri` plus, at most, a query: same scheme (schemes are
/// case-insensitive, and the `url` crate lowercases the parsed one) and the same
/// path. A prefix match on the scheme would accept every Google client's
/// redirect, not just ours.
#[cfg(any(mobile, test))]
fn matches_redirect_uri(url: &Url, redirect_uri: &str) -> bool {
    Url::parse(redirect_uri).is_ok_and(|expected| {
        url.scheme().eq_ignore_ascii_case(expected.scheme()) && url.path() == expected.path()
    })
}

// --- token persistence (encrypted `auth/gdrive.swftx`) ---

pub fn read_tokens(app: &AppHandle, cryptor: &Cryptor) -> Option<Tokens> {
    let blob = storage::read_gdrive(app).ok().filter(|b| !b.is_empty())?;
    let json = cryptor.decrypt(&blob).ok()?;
    serde_json::from_str(&json).ok()
}

fn write_tokens(app: &AppHandle, cryptor: &Cryptor, tokens: &Tokens) -> Result<()> {
    let json = serde_json::to_string(tokens)?;
    storage::write_gdrive(app, &cryptor.encrypt(&json)?)
}

pub fn is_configured(app: &AppHandle, cryptor: &Cryptor) -> bool {
    read_tokens(app, cryptor).is_some_and(|t| t.access_token.is_some() || t.refresh_token.is_some())
}

// Keep only the refresh token (parity with legacy disconnect).
pub fn disconnect(app: &AppHandle, cryptor: &Cryptor) -> Result<()> {
    let refresh_token = read_tokens(app, cryptor).and_then(|t| t.refresh_token);
    write_tokens(
        app,
        cryptor,
        &Tokens {
            refresh_token,
            ..Default::default()
        },
    )
}

// --- OAuth flow ---

/// One consent request in flight: the PKCE verifier the code will be redeemed
/// with, and the `state` nonce the redirect has to echo to be believed.
pub struct Started {
    pub verifier: String,
    pub state: String,
}

// Send the user to Google's consent page, and hand back what the redirect will
// need to be recognised and redeemed.
fn open_consent(app: &AppHandle, credentials: &Credentials) -> Result<Started> {
    let started = Started {
        verifier: gen_nonce(),
        state: gen_nonce(),
    };
    let url = auth_url(credentials, &challenge(&started.verifier), &started.state)?;
    app.opener().open_url(url, None::<&str>).map_err(other)?;
    Ok(started)
}

/// Desktop: open the browser and block on the loopback listener until Google
/// redirects to it, then exchange the code.
#[cfg(desktop)]
pub fn authenticate(app: &AppHandle, cryptor: &Cryptor) -> Result<()> {
    let credentials = Credentials::resolve(app)?;
    let started = open_consent(app, &credentials)?;
    let code = listen_for_code(&started.state)?;
    let client = super::http_client();
    let tokens = tauri::async_runtime::block_on(exchange_code(
        &client,
        &credentials,
        &code,
        &started.verifier,
    ))?;
    write_tokens(app, cryptor, &tokens)
}

/// Mobile, first half: open the consent page and hand back what the caller
/// must keep until the redirect arrives.
#[cfg(mobile)]
pub fn begin(app: &AppHandle) -> Result<Started> {
    open_consent(app, &Credentials::resolve(app)?)
}

/// Mobile, second half: exchange a code [`parse_redirect`] accepted and store
/// the tokens. Async — this runs off the URL-open callback, not on it.
#[cfg(mobile)]
pub async fn complete(
    app: &AppHandle,
    cryptor: &Cryptor,
    code: &str,
    verifier: &str,
) -> Result<()> {
    let credentials = Credentials::resolve(app)?;
    let tokens = exchange_code(&super::http_client(), &credentials, code, verifier).await?;
    write_tokens(app, cryptor, &tokens)
}

/// Read a redirect URL as the answer to the request identified by `state`.
///
/// The nonce is checked before anything else is believed: a URL without it, or
/// with someone else's, is [`Redirect::Foreign`] no matter what code or error
/// it carries.
pub fn parse_redirect(url: &Url, state: &str) -> Redirect {
    let mut code = None;
    let mut error = None;
    let mut echoed = None;
    for (key, value) in url.query_pairs() {
        match &*key {
            "code" => code = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            "state" => echoed = Some(value.into_owned()),
            _ => {}
        }
    }
    if echoed.as_deref() != Some(state) {
        return Redirect::Foreign;
    }
    match code {
        Some(code) => Redirect::Code(code),
        None => Redirect::Denied(
            error.unwrap_or_else(|| "Authorization was cancelled or failed".into()),
        ),
    }
}

// Return a valid access token, refreshing it if expired.
pub async fn access_token(client: &Client, app: &AppHandle, cryptor: &Cryptor) -> Result<String> {
    let mut tokens = read_tokens(app, cryptor).ok_or(Error::SyncNotConfigured)?;
    if needs_refresh(&tokens) {
        let refresh_token = tokens
            .refresh_token
            .clone()
            .ok_or(Error::SyncNotConfigured)?;
        let fresh = refresh(client, &Credentials::resolve(app)?, &refresh_token).await?;
        tokens.access_token = fresh.access_token;
        tokens.expires_at = fresh.expires_at;
        if fresh.refresh_token.is_some() {
            tokens.refresh_token = fresh.refresh_token;
        }
        write_tokens(app, cryptor, &tokens)?;
    }
    tokens.access_token.ok_or(Error::SyncNotConfigured)
}

fn needs_refresh(tokens: &Tokens) -> bool {
    match tokens.expires_at {
        _ if tokens.access_token.is_none() => true,
        Some(expires_at) => expires_at <= chrono::Utc::now().timestamp() + 60,
        None => true,
    }
}

fn auth_url(credentials: &Credentials, challenge: &str, state: &str) -> Result<String> {
    let mut url = Url::parse(AUTH_URL).map_err(other)?;
    url.query_pairs_mut()
        .append_pair("client_id", &credentials.client_id)
        .append_pair("redirect_uri", &credentials.redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", SCOPE)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("state", state)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256");
    Ok(url.into())
}

async fn exchange_code(
    client: &Client,
    credentials: &Credentials,
    code: &str,
    verifier: &str,
) -> Result<Tokens> {
    let form = vec![
        ("code", code.to_string()),
        ("redirect_uri", credentials.redirect_uri.clone()),
        ("grant_type", "authorization_code".to_string()),
        ("code_verifier", verifier.to_string()),
    ];
    post_token(client, credentials, form).await
}

async fn refresh(
    client: &Client,
    credentials: &Credentials,
    refresh_token: &str,
) -> Result<Tokens> {
    let form = vec![
        ("refresh_token", refresh_token.to_string()),
        ("grant_type", "refresh_token".to_string()),
    ];
    post_token(client, credentials, form).await
}

async fn post_token(
    client: &Client,
    credentials: &Credentials,
    mut form: Vec<(&str, String)>,
) -> Result<Tokens> {
    form.push(("client_id", credentials.client_id.clone()));
    if let Some(secret) = &credentials.secret {
        form.push(("client_secret", secret.clone()));
    }
    let resp = client
        .post(TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(other)?;
    let status = resp.status();
    let body = resp.text().await.map_err(other)?;
    if !status.is_success() {
        return Err(Error::Other(format!("OAuth token error {status}: {body}")));
    }
    let parsed: TokenResponse = serde_json::from_str(&body).map_err(other)?;
    Ok(Tokens {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
        expires_at: parsed
            .expires_in
            .map(|s| chrono::Utc::now().timestamp() + s),
    })
}

// --- PKCE ---

// 48 random bytes, url-safe: within the 43-128 characters PKCE allows a
// verifier, and more than enough for the `state` nonce.
fn gen_nonce() -> String {
    let mut bytes = [0u8; 48];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

// --- loopback listener (desktop) ---

// Block until the browser hits the callback, returning the auth code.
#[cfg(desktop)]
fn listen_for_code(state: &str) -> Result<String> {
    let listener = TcpListener::bind((HOST, PORT)).map_err(other)?;
    let (mut stream, _) = listener.accept()?;
    stream.set_read_timeout(Some(Duration::from_secs(300)))?;

    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    // "GET /auth/callback?code=... HTTP/1.1"
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    let url = Url::parse(&format!("http://{HOST}:{PORT}{path}")).map_err(other)?;
    let code = match parse_redirect(&url, state) {
        Redirect::Code(code) => Ok(code),
        Redirect::Denied(error) => Err(Error::Other(error)),
        Redirect::Foreign => Err(Error::Other(
            "the browser's reply did not match this sign-in request".into(),
        )),
    };

    let _ = stream.write_all(response_html(code.as_ref().err()).as_bytes());
    code
}

#[cfg(desktop)]
fn response_html(error: Option<&Error>) -> String {
    let (status, body) = match error {
        None => (
            "200 OK",
            format!(
                "<h2>You've successfully connected!</h2><p>You may now close this window and return to {APP_NAME}.</p>"
            ),
        ),
        Some(error) => (
            "400 Bad Request",
            format!("<h2>Failed to connect your Google Drive account.</h2><p>{error}</p>"),
        ),
    };
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n\
         <!doctype html><html><body style=\"font-family:sans-serif;text-align:center;padding:64px\">{body}</body></html>"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_challenge_is_url_safe_sha256() {
        // Known RFC 7636 test vector.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            challenge(verifier),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn verifier_length_within_pkce_bounds() {
        let v = gen_nonce();
        assert!((43..=128).contains(&v.len()));
    }

    #[test]
    fn the_consent_url_carries_the_state() {
        let credentials = Credentials {
            client_id: "1-a.apps.googleusercontent.com".into(),
            redirect_uri: "com.googleusercontent.apps.1-a:/oauth2redirect".into(),
            secret: None,
        };
        let url = Url::parse(&auth_url(&credentials, "chal", "nonce-1").unwrap()).unwrap();
        let state = url
            .query_pairs()
            .find(|(k, _)| k == "state")
            .map(|(_, v)| v.into_owned());
        assert_eq!(state.as_deref(), Some("nonce-1"));
    }

    #[test]
    fn only_the_exact_redirect_matches() {
        let ours = "com.googleusercontent.apps.1-a:/oauth2redirect";
        let matches = |s: &str| matches_redirect_uri(&Url::parse(s).unwrap(), ours);
        assert!(matches(
            "com.googleusercontent.apps.1-a:/oauth2redirect?code=x&state=s"
        ));
        // Schemes are case-insensitive.
        assert!(matches("COM.googleusercontent.apps.1-a:/oauth2redirect"));
        // Another Google client's scheme shares the prefix and is not ours.
        assert!(!matches(
            "com.googleusercontent.apps.2-b:/oauth2redirect?code=x"
        ));
        // Our scheme, some other path.
        assert!(!matches("com.googleusercontent.apps.1-a:/anything?code=x"));
        assert!(!matches("swifty:/oauth2redirect"));
    }

    #[test]
    fn ios_scheme_and_client_id_are_inverses() {
        let scheme = "com.googleusercontent.apps.123456-abcdef";
        let client_id = "123456-abcdef.apps.googleusercontent.com";
        assert_eq!(client_id_from_scheme(scheme).as_deref(), Some(client_id));
        assert_eq!(scheme_from_client_id(client_id).as_deref(), Some(scheme));
        assert_eq!(
            format!("{scheme}{IOS_REDIRECT_PATH}"),
            "com.googleusercontent.apps.123456-abcdef:/oauth2redirect"
        );
    }

    #[test]
    fn a_foreign_scheme_yields_no_client_id() {
        assert!(client_id_from_scheme("swifty").is_none());
        // The prefix alone names no client.
        assert!(client_id_from_scheme("com.googleusercontent.apps.").is_none());
        assert!(scheme_from_client_id("123-abc.example.com").is_none());
    }

    const REDIRECT: &str = "com.googleusercontent.apps.1-a:/oauth2redirect";

    #[test]
    fn a_redirect_with_our_state_yields_its_code() {
        let url = Url::parse(&format!("{REDIRECT}?code=4/abc&scope=x&state=nonce-1")).unwrap();
        assert_eq!(
            parse_redirect(&url, "nonce-1"),
            Redirect::Code("4/abc".into())
        );
    }

    #[test]
    fn a_denied_redirect_yields_googles_error() {
        let url = Url::parse(&format!("{REDIRECT}?error=access_denied&state=nonce-1")).unwrap();
        assert_eq!(
            parse_redirect(&url, "nonce-1"),
            Redirect::Denied("access_denied".into())
        );
    }

    #[test]
    fn a_redirect_with_neither_is_a_cancellation() {
        let url = Url::parse(&format!("{REDIRECT}?state=nonce-1")).unwrap();
        match parse_redirect(&url, "nonce-1") {
            Redirect::Denied(why) => assert!(why.contains("cancelled")),
            other => panic!("{other:?}"),
        }
    }

    // The whole point of the nonce: a code — or an error — on our scheme that
    // does not echo our state is nobody's business of ours, and must not end a
    // flow that is still waiting for the real answer.
    #[test]
    fn a_redirect_with_the_wrong_or_no_state_is_foreign() {
        let wrong = Url::parse(&format!("{REDIRECT}?code=4/abc&state=someone-elses")).unwrap();
        assert_eq!(parse_redirect(&wrong, "nonce-1"), Redirect::Foreign);
        let missing = Url::parse(&format!("{REDIRECT}?code=4/abc")).unwrap();
        assert_eq!(parse_redirect(&missing, "nonce-1"), Redirect::Foreign);
        let denied = Url::parse(&format!("{REDIRECT}?error=access_denied")).unwrap();
        assert_eq!(parse_redirect(&denied, "nonce-1"), Redirect::Foreign);
    }
}
