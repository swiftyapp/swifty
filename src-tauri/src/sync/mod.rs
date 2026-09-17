//! Google Drive sync provider. Finds (or creates) a "Rowel" folder and the
//! `vault.swsync` pack inside it, and reads/writes that one file.
//!
//! This module is only the *transport*: the sync algorithm lives in [`engine`],
//! behind the [`engine::Remote`] trait that [`DriveRemote`] implements. Drive's
//! REST calls are async and are driven with `block_on` here, which is safe
//! because a run always executes on its own thread (see `commands::sync`) —
//! never on a command thread, and never on a runtime worker.

mod auth;
// Crate-visible: `share::remote` drives the same Drive REST surface.
pub(crate) mod drive;
pub mod engine;
// Every name Drive sees: folders, file names, extensions. Crate-visible so
// sharing and the backup export spell them the same way.
pub mod layout;
pub mod pack;
pub mod restore;
// First-run onboarding's keyless view of the account. Named for the flow, not
// for `setup` below — modules and functions live in separate namespaces.
pub mod setup;

use std::sync::Mutex;
use std::time::Duration;

use reqwest::Client;
use tauri::{async_runtime::block_on, AppHandle, Manager};

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::state::AppState;
use engine::{Remote, RemoteFile, SessionVault, SyncOutcome};

/// A valid Drive access token for the connected account, refreshed if needed.
/// Crate-visible so `share::remote` can act on the same account.
pub(crate) async fn access_token(
    client: &Client,
    app: &AppHandle,
    cryptor: &Cryptor,
) -> Result<String> {
    auth::access_token(client, app, cryptor).await
}

/// The OAuth tokens for one account, as onboarding holds them: in memory, for
/// the stretch between the user approving consent and a vault key existing to
/// seal them under.
pub(crate) use auth::Tokens;

/// Seal `tokens` under `cryptor` and write them where a later unlock will find
/// them — the step [`setup`] does for itself and onboarding defers.
pub(crate) fn persist_tokens(app: &AppHandle, cryptor: &Cryptor, tokens: &Tokens) -> Result<()> {
    auth::write_tokens(app, cryptor, tokens)
}

/// A valid access token for in-memory `tokens`, refreshed in place if expired.
pub(crate) async fn fresh_access_token(
    client: &Client,
    app: &AppHandle,
    tokens: &mut Tokens,
) -> Result<String> {
    auth::fresh_access_token(client, app, tokens).await
}

/// The desktop consent flow without the persisting: onboarding's half of
/// [`setup`], for an install that has no vault key yet.
#[cfg(desktop)]
pub(crate) fn obtain_tokens(app: &AppHandle) -> Result<Tokens> {
    auth::obtain_tokens(app)
}

/// The mobile twin of [`obtain_tokens`]: redeem a code the deep-link handler
/// accepted, and hand the tokens back rather than writing them.
#[cfg(mobile)]
pub(crate) use auth::exchange_for_tokens;

/// Install the ring rustls provider, once per process.
///
/// reqwest is built with `rustls-no-provider`, and building a `Client` before a
/// provider is installed is a panic, not an error. Our own clients all come
/// through [`http_client`], which installs first — but on iOS and Android Tauri
/// itself builds a reqwest client during launch (the `tauri://` protocol proxies
/// the dev server through one, see `tauri/src/protocol/tauri.rs`), so `run()`
/// has to install before `tauri::Builder` ever runs. Idempotent.
pub(crate) fn install_crypto_provider() {
    static ONCE: std::sync::OnceLock<()> = std::sync::OnceLock::new();
    ONCE.get_or_init(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}

/// How long a connection may take to come up, and how long a response may go
/// silent mid-body, before the request fails. Deadlines on the *stall*, not on
/// the whole request: a pack upload on a slow link legitimately takes minutes,
/// but a peer that stops answering must not hold a run — and with it the
/// `syncing` flag, `sync_now` and every workspace switch — open until the
/// process exits. Callers that know their body is small add a whole-request
/// `timeout` on top (favicons, shares).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const READ_TIMEOUT: Duration = Duration::from_secs(60);

/// The builder every HTTPS client in the app starts from: provider installed
/// (see [`install_crypto_provider`] for why that comes first), deadlines set.
/// For a caller that needs one more setting — a redirect policy, a total
/// timeout — on top of the shared ones.
pub(crate) fn http_client_builder() -> reqwest::ClientBuilder {
    install_crypto_provider();
    Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
}

// Build the shared HTTPS client.
pub(crate) fn http_client() -> Client {
    // Same failure mode as `Client::new`, which also panics: the builder only
    // fails when the TLS backend cannot be set up, and nothing in this app
    // works without it.
    http_client_builder()
        .build()
        .expect("the HTTPS client could not be built")
}

pub fn is_configured(app: &AppHandle, cryptor: &Cryptor) -> bool {
    auth::is_configured(app, cryptor)
}

// Run the OAuth consent flow and persist the resulting tokens — unless a
// disconnect has moved the connection past `generation` since the flow was
// started. Desktop only: it blocks on the loopback listener, which no mobile
// OS will redirect to.
#[cfg(desktop)]
pub fn setup(app: &AppHandle, cryptor: &Cryptor, generation: u64) -> Result<()> {
    auth::authenticate(app, cryptor, generation)
}

// The mobile consent flow, cut in two around the browser hand-off. See
// `auth.rs`; the halves are joined by the deep-link handler in `lib.rs`.
#[cfg(mobile)]
pub use auth::{begin, complete, parse_redirect, redirect_matches, Redirect};

/// Drop the account locally, handing back the tokens that were stored so the
/// caller can [`revoke`] them. An error means the token file is still on disk
/// and the account is therefore still connected.
pub fn disconnect(app: &AppHandle, cryptor: &Cryptor) -> Result<Option<Tokens>> {
    auth::disconnect(app, cryptor)
}

/// Re-seal the stored tokens under a new vault key (a password change). A
/// missing token file is a no-op, not an error.
pub fn reseal_tokens(app: &AppHandle, old: &Cryptor, new: &Cryptor) -> Result<()> {
    auth::reseal_tokens(app, old, new)
}

/// Which Drive connection is current. A consent flow reads it *when it
/// starts*, on the command thread, and hands it to the half that stores the
/// tokens ([`setup`] on desktop, [`complete`] on mobile), which refuses them
/// for a connection a disconnect has since ended.
pub fn connection_generation(app: &AppHandle) -> u64 {
    auth::connection_generation(app)
}

/// Retire a disconnected account's grant at Google. Best effort: the local
/// disconnect stands whatever happens here.
pub(crate) async fn revoke(tokens: &Tokens) {
    if let Some(token) = auth::revocable(tokens) {
        auth::revoke(&http_client(), token).await;
    }
}

/// One full sync against Drive. Blocking: call it on a dedicated thread.
pub fn run(app: &AppHandle, cryptor: Cryptor) -> Result<SyncOutcome> {
    if !is_configured(app, &cryptor) {
        return Err(Error::SyncNotConfigured);
    }
    let remote = DriveRemote::new(app.clone(), cryptor);
    let local = SessionVault::capture(app)?;
    let outcome = engine::sync(&remote, &local, now_ms())?;
    sweep_shares(app);
    Ok(outcome)
}

/// Drop expired one-time shares, riding along on a run that has just proved the
/// account reachable. Best effort: a locked vault or a failed listing is not a
/// sync failure, and the next run sweeps again.
fn sweep_shares(app: &AppHandle) {
    // `run` moved its own cryptor into the remote and `Cryptor` is not `Clone`,
    // so take a second from the session — which is also how we notice the vault
    // locked while the sync was in flight.
    let Ok(cryptor) = app.state::<AppState>().session.lock().unwrap().cryptor() else {
        return;
    };
    if let Err(e) = crate::share::sweep_drive(app, cryptor) {
        log::warn!("share sweep failed: {e}");
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// [`Remote`] over one Drive folder + file pair.
///
/// The folder id is resolved once per instance (one instance per run) because
/// the selection rule is deterministic and re-listing it would only cost round
/// trips. The *file* is re-listed on every call: `head_revision` exists
/// precisely to observe a change another device made, so it must never answer
/// from a cache.
struct DriveRemote {
    app: AppHandle,
    cryptor: Cryptor,
    folder: Mutex<Option<String>>,
}

impl DriveRemote {
    fn new(app: AppHandle, cryptor: Cryptor) -> Self {
        Self {
            app,
            cryptor,
            folder: Mutex::new(None),
        }
    }

    // Resolve the Rowel folder, remembering it for the rest of the run.
    // `None` means it does not exist yet — which is also "no remote vault".
    async fn folder(&self, client: &Client, token: &str) -> Result<Option<String>> {
        if let Some(id) = self.folder.lock().unwrap().clone() {
            return Ok(Some(id));
        }
        let found = drive::folder_id(client, token, layout::ROOT_FOLDER).await?;
        if let Some(id) = &found {
            *self.folder.lock().unwrap() = Some(id.clone());
        }
        Ok(found)
    }

    async fn locate(&self, client: &Client, token: &str) -> Result<Option<drive::DriveFile>> {
        let Some(folder) = self.folder(client, token).await? else {
            return Ok(None);
        };
        drive::find_file(client, token, layout::LEGACY_VAULT_FILE, &folder).await
    }

    async fn token(&self, client: &Client) -> Result<String> {
        auth::access_token(client, &self.app, &self.cryptor).await
    }
}

impl Remote for DriveRemote {
    fn fetch(&self) -> Result<Option<RemoteFile>> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            let Some(file) = self.locate(&client, &token).await? else {
                return Ok(None);
            };
            let bytes = drive::read_file(&client, &token, &file.id, pack::MAX_PACK_BYTES).await?;
            Ok(Some(RemoteFile {
                bytes,
                revision: file.head_revision.unwrap_or_default(),
            }))
        })
    }

    fn head_revision(&self) -> Result<Option<String>> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            let Some(file) = self.locate(&client, &token).await? else {
                return Ok(None);
            };
            // Read from the listing, exactly like `fetch` — the pre-flight
            // compares this against `fetch`'s value, so the two must degrade
            // identically. A `files.get` fallback here once made a missing
            // listing field compare `Some(real)` against `fetch`'s `Some("")`,
            // which would burn every retry and fail the run.
            Ok(Some(file.head_revision.unwrap_or_default()))
        })
    }

    fn upload(&self, bytes: &[u8]) -> Result<String> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            let folder = match self.folder(&client, &token).await? {
                Some(id) => id,
                None => {
                    let id = drive::create_folder(&client, &token, layout::ROOT_FOLDER).await?;
                    *self.folder.lock().unwrap() = Some(id.clone());
                    id
                }
            };
            let revision = match drive::find_file(&client, &token, layout::LEGACY_VAULT_FILE, &folder).await?
            {
                Some(file) => drive::update_file(&client, &token, &file.id, bytes).await?,
                None => {
                    drive::create_file(&client, &token, layout::LEGACY_VAULT_FILE, &folder, bytes)
                        .await?
                        .head_revision
                }
            };
            Ok(revision.unwrap_or_default())
        })
    }
}
