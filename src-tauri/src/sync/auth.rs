//! Google OAuth2 with PKCE for a Desktop-app client (port of `gdrive/auth.js`).
//! The consent URL opens in the browser; a one-shot loopback listener on
//! 127.0.0.1 captures the auth code; tokens are stored encrypted via the vault
//! cryptor. Credentials come from env vars with documented placeholders.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
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

use crate::app::APP_NAME;
use crate::error::{Error, Result};
use crate::{crypto::Cryptor, storage};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 4567;
const CALLBACK: &str = "/auth/callback";
const SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

// Supply your own Google Desktop OAuth client at build or run time.
const CLIENT_ID_PLACEHOLDER: &str = "YOUR_GOOGLE_OAUTH_CLIENT_ID";

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

fn redirect_uri() -> String {
    format!("http://{HOST}:{PORT}{CALLBACK}")
}

fn client_id() -> Result<String> {
    let id = std::env::var("GOOGLE_OAUTH_CLIENT_ID")
        .ok()
        .or_else(|| option_env!("GOOGLE_OAUTH_CLIENT_ID").map(String::from))
        .unwrap_or_default();
    if id.is_empty() || id == CLIENT_ID_PLACEHOLDER {
        return Err(Error::Other(
            "Google OAuth client not configured; set GOOGLE_OAUTH_CLIENT_ID".into(),
        ));
    }
    Ok(id)
}

// Desktop clients ship a (non-confidential) secret; optional so PKCE-only
// clients also work.
fn client_secret() -> Option<String> {
    std::env::var("GOOGLE_OAUTH_CLIENT_SECRET")
        .ok()
        .or_else(|| option_env!("GOOGLE_OAUTH_CLIENT_SECRET").map(String::from))
        .filter(|s| !s.is_empty())
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

pub fn authenticate(app: &AppHandle, cryptor: &Cryptor) -> Result<()> {
    let verifier = gen_verifier();
    let url = auth_url(&challenge(&verifier))?;
    app.opener().open_url(url, None::<&str>).map_err(other)?;
    let code = listen_for_code()?;
    let client = super::http_client();
    let tokens = tauri::async_runtime::block_on(exchange_code(&client, &code, &verifier))?;
    write_tokens(app, cryptor, &tokens)
}

// Return a valid access token, refreshing it if expired.
pub async fn access_token(client: &Client, app: &AppHandle, cryptor: &Cryptor) -> Result<String> {
    let mut tokens = read_tokens(app, cryptor).ok_or(Error::SyncNotConfigured)?;
    if needs_refresh(&tokens) {
        let refresh_token = tokens
            .refresh_token
            .clone()
            .ok_or(Error::SyncNotConfigured)?;
        let fresh = refresh(client, &refresh_token).await?;
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

fn auth_url(challenge: &str) -> Result<String> {
    let mut url = Url::parse(AUTH_URL).map_err(other)?;
    url.query_pairs_mut()
        .append_pair("client_id", &client_id()?)
        .append_pair("redirect_uri", &redirect_uri())
        .append_pair("response_type", "code")
        .append_pair("scope", SCOPE)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256");
    Ok(url.into())
}

async fn exchange_code(client: &Client, code: &str, verifier: &str) -> Result<Tokens> {
    let mut form = vec![
        ("code", code.to_string()),
        ("client_id", client_id()?),
        ("redirect_uri", redirect_uri()),
        ("grant_type", "authorization_code".to_string()),
        ("code_verifier", verifier.to_string()),
    ];
    if let Some(secret) = client_secret() {
        form.push(("client_secret", secret));
    }
    post_token(client, form).await
}

async fn refresh(client: &Client, refresh_token: &str) -> Result<Tokens> {
    let mut form = vec![
        ("client_id", client_id()?),
        ("refresh_token", refresh_token.to_string()),
        ("grant_type", "refresh_token".to_string()),
    ];
    if let Some(secret) = client_secret() {
        form.push(("client_secret", secret));
    }
    post_token(client, form).await
}

async fn post_token(client: &Client, form: Vec<(&str, String)>) -> Result<Tokens> {
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

fn gen_verifier() -> String {
    let mut bytes = [0u8; 48];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

// --- loopback listener ---

// Block until the browser hits the callback, returning the auth code.
fn listen_for_code() -> Result<String> {
    let listener = TcpListener::bind((HOST, PORT)).map_err(other)?;
    let (mut stream, _) = listener.accept()?;
    stream.set_read_timeout(Some(Duration::from_secs(300)))?;

    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    // "GET /auth/callback?code=... HTTP/1.1"
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    let url = Url::parse(&format!("http://{HOST}:{PORT}{path}")).map_err(other)?;
    let code = url
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.into_owned());
    let error = url
        .query_pairs()
        .find(|(k, _)| k == "error")
        .map(|(_, v)| v.into_owned());

    let ok = code.is_some();
    let _ = stream.write_all(response_html(ok, error.as_deref()).as_bytes());

    code.ok_or_else(|| Error::Other("Authorization was cancelled or failed".into()))
}

fn response_html(ok: bool, error: Option<&str>) -> String {
    let (status, body) = if ok {
        (
            "200 OK",
            format!(
                "<h2>You've successfully connected!</h2><p>You may now close this window and return to {APP_NAME}.</p>"
            ),
        )
    } else {
        (
            "400 Bad Request",
            format!(
                "<h2>Failed to connect your Google Drive account.</h2><p>{}</p>",
                error.unwrap_or("Unknown error")
            ),
        )
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
        let v = gen_verifier();
        assert!((43..=128).contains(&v.len()));
    }
}
