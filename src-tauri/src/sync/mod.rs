//! Google Drive sync provider. Finds (or creates) a "Swifty" folder and the
//! `vault.swsync` pack inside it, and reads/writes that one file.
//!
//! This module is only the *transport*: the sync algorithm lives in [`engine`],
//! behind the [`engine::Remote`] trait that [`DriveRemote`] implements. Drive's
//! REST calls are async and are driven with `block_on` here, which is safe
//! because a run always executes on its own thread (see `commands::sync`) —
//! never on a command thread, and never on a runtime worker.

mod auth;
mod drive;
pub mod engine;
pub mod pack;
pub mod restore;

use std::sync::Mutex;

use reqwest::Client;
use tauri::{async_runtime::block_on, AppHandle};

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use engine::{Remote, RemoteFile, SessionVault, SyncOutcome};

const FOLDER_NAME: &str = "Swifty";

// Build an HTTPS client, installing the ring rustls provider once per process
// (reqwest is built with `rustls-no-provider`).
pub(crate) fn http_client() -> Client {
    static ONCE: std::sync::OnceLock<()> = std::sync::OnceLock::new();
    ONCE.get_or_init(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
    Client::new()
}

pub fn is_configured(app: &AppHandle, cryptor: &Cryptor) -> bool {
    auth::is_configured(app, cryptor)
}

// Run the OAuth consent flow and persist the resulting tokens.
pub fn setup(app: &AppHandle, cryptor: &Cryptor) -> Result<()> {
    auth::authenticate(app, cryptor)
}

pub fn disconnect(app: &AppHandle, cryptor: &Cryptor) -> Result<()> {
    auth::disconnect(app, cryptor)
}

/// One full sync against Drive. Blocking: call it on a dedicated thread.
pub fn run(app: &AppHandle, cryptor: Cryptor) -> Result<SyncOutcome> {
    if !is_configured(app, &cryptor) {
        return Err(Error::SyncNotConfigured);
    }
    let remote = DriveRemote::new(app.clone(), cryptor);
    let local = SessionVault::capture(app)?;
    engine::sync(&remote, &local, now_ms())
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

    // Resolve the Swifty folder, remembering it for the rest of the run.
    // `None` means it does not exist yet — which is also "no remote vault".
    async fn folder(&self, client: &Client, token: &str) -> Result<Option<String>> {
        if let Some(id) = self.folder.lock().unwrap().clone() {
            return Ok(Some(id));
        }
        let found = drive::folder_id(client, token, FOLDER_NAME).await?;
        if let Some(id) = &found {
            *self.folder.lock().unwrap() = Some(id.clone());
        }
        Ok(found)
    }

    async fn locate(&self, client: &Client, token: &str) -> Result<Option<drive::DriveFile>> {
        let Some(folder) = self.folder(client, token).await? else {
            return Ok(None);
        };
        drive::find_file(client, token, pack::FILE_NAME, &folder).await
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
            let bytes = drive::read_file(&client, &token, &file.id).await?;
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
                    let id = drive::create_folder(&client, &token, FOLDER_NAME).await?;
                    *self.folder.lock().unwrap() = Some(id.clone());
                    id
                }
            };
            let revision = match drive::find_file(&client, &token, pack::FILE_NAME, &folder).await?
            {
                Some(file) => drive::update_file(&client, &token, &file.id, bytes).await?,
                None => {
                    drive::create_file(&client, &token, pack::FILE_NAME, &folder, bytes)
                        .await?
                        .head_revision
                }
            };
            Ok(revision.unwrap_or_default())
        })
    }
}
