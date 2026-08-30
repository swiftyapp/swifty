//! Google Drive sync provider (port of legacy `sync/gdrive/index.js` +
//! `sync/index.js`). Finds/creates a "Swifty" folder and vault file, and
//! reads/writes the remote vault. Async Drive/OAuth calls are driven on Tauri's
//! runtime so the command layer stays synchronous.

mod auth;
mod drive;
pub mod merge;

use reqwest::Client;
use tauri::{async_runtime::block_on, AppHandle};

use crate::crypto::Cryptor;
use crate::error::{Error, Result};

const FOLDER_NAME: &str = "Swifty";
const FILE_NAME: &str = "vault.swftx";

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

pub fn remote_vault_exists(app: &AppHandle, cryptor: &Cryptor) -> Result<bool> {
    block_on(async {
        let client = http_client();
        let token = auth::access_token(&client, app, cryptor).await?;
        let Some(folder) = drive::folder_id(&client, &token, FOLDER_NAME).await? else {
            return Ok(false);
        };
        Ok(drive::file_id(&client, &token, FILE_NAME, &folder).await?.is_some())
    })
}

// Read the remote vault blob, erroring if the folder or file is missing.
pub fn pull(app: &AppHandle, cryptor: &Cryptor) -> Result<String> {
    block_on(async {
        let client = http_client();
        let token = auth::access_token(&client, app, cryptor).await?;
        let folder = drive::folder_id(&client, &token, FOLDER_NAME)
            .await?
            .ok_or_else(|| Error::Other("Swifty folder was not found on GDrive".into()))?;
        let file = drive::file_id(&client, &token, FILE_NAME, &folder)
            .await?
            .ok_or_else(|| Error::Other("Vault file was not found on GDrive".into()))?;
        drive::read_file(&client, &token, &file).await
    })
}

// Write the vault blob, creating the folder/file on first push (create-or-update).
pub fn push(app: &AppHandle, cryptor: &Cryptor, data: &str) -> Result<()> {
    block_on(async {
        let client = http_client();
        let token = auth::access_token(&client, app, cryptor).await?;
        let folder = match drive::folder_id(&client, &token, FOLDER_NAME).await? {
            Some(id) => id,
            None => drive::create_folder(&client, &token, FOLDER_NAME).await?,
        };
        match drive::file_id(&client, &token, FILE_NAME, &folder).await? {
            Some(id) => drive::update_file(&client, &token, &id, data).await,
            None => drive::create_file(&client, &token, FILE_NAME, &folder, data)
                .await
                .map(|_| ()),
        }
    })
}
