//! The browser extension host.
//!
//! Rowel speaks the KeePassXC-Browser protocol, so the stock KeePassXC-Browser
//! extension fills logins from a Rowel vault with no extension code of our
//! own. The browser launches this binary as the extension's native messaging
//! host (`proxy`), which relays stdio to the running app over a local socket
//! (`server`); the app answers each request from the open vault (`actions`)
//! inside the protocol's sealed envelope (`protocol`). Browsers find the host
//! through the manifests `manifest` writes when the user turns this on.
//!
//! What the extension can reach is what the user could copy: the logins for
//! the site it is on, a TOTP code, a generated password, and the lock. An
//! extension gets in once, by the user naming it in a dialog; after that its
//! identification key, kept in `settings.json`, is what it proves itself with.

pub mod actions;
pub mod frame;
pub mod manifest;
pub mod protocol;
pub mod proxy;
pub mod server;
#[cfg(test)]
mod tests;

use std::io;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{sync_channel, SyncSender};
use std::sync::Mutex;
use std::time::Duration;

use interprocess::local_socket::{prelude::*, Name};
use serde_json::json;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use self::actions::{Client, Host, Login};
use crate::models::GeneratorOptions;
use crate::settings::{self, BrowserClient};
use crate::state::AppState;
use crate::store::VaultStore;
use crate::{commands, events, session, window};

/// The bundle identifier, which is the app-data directory's name on every
/// desktop platform. The proxy has no `AppHandle` to ask, so it is spelled out
/// here; a test holds it to `tauri.conf.json`.
pub const IDENTIFIER: &str = "app.rowel.desktop";
pub const SOCKET_FILE: &str = "browser.sock";

/// How long an `associate` waits for the user's answer before it is refused.
pub const CONSENT_TIMEOUT: Duration = Duration::from_secs(60);

/// The app's data directory, resolved the way `storage::root_dir` resolves it
/// but without Tauri: the debug override, then the platform's app-data
/// directory under the identifier, with a `dev` subdirectory in debug builds.
pub fn root_dir() -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        if let Ok(dir) = std::env::var("ROWEL_DB_DIR") {
            return Some(PathBuf::from(dir));
        }
    }
    let dir = dirs::data_dir()?.join(IDENTIFIER);
    Some(if cfg!(debug_assertions) {
        dir.join("dev")
    } else {
        dir
    })
}

/// The socket the app listens on for `root`: a file beside the vault on Unix,
/// and on Windows a named pipe whose name carries a digest of `root`, so a
/// debug build and a release build — or a test — never share one.
pub fn socket_name(root: &Path) -> io::Result<Name<'static>> {
    #[cfg(unix)]
    {
        use interprocess::local_socket::GenericFilePath;
        root.join(SOCKET_FILE).to_fs_name::<GenericFilePath>()
    }
    #[cfg(windows)]
    {
        use interprocess::local_socket::GenericNamespaced;
        let digest = Sha256::digest(root.to_string_lossy().as_bytes());
        format!("{IDENTIFIER}.browser.{}", hex::encode(&digest[..8]))
            .to_ns_name::<GenericNamespaced>()
    }
}

// --- consent -------------------------------------------------------------------
//
// One `associate` at a time waits on the user. The connection thread parks on
// the receiving end; the frontend's answer arrives through `respond`, from the
// command the dialog invokes.

static PENDING: Mutex<Option<SyncSender<Option<String>>>> = Mutex::new(None);

/// Ask the user whether the extension holding `key` may connect. Blocks the
/// calling thread for the answer, up to [`CONSENT_TIMEOUT`]; a second ask
/// while one is up is refused rather than queued.
pub fn ask(app: &AppHandle, key: &str) -> Option<String> {
    let (sender, receiver) = sync_channel(1);
    {
        let mut pending = PENDING.lock().unwrap_or_else(|e| e.into_inner());
        if pending.is_some() {
            return None;
        }
        *pending = Some(sender);
    }
    events::browser_associate(app, key);
    window::raise(app);
    let answer = receiver.recv_timeout(CONSENT_TIMEOUT).ok().flatten();
    PENDING.lock().unwrap_or_else(|e| e.into_inner()).take();
    answer
}

/// The user's answer to the ask that is up: the name they gave the extension,
/// or `None` for a refusal. Returns whether an ask was waiting for it.
pub fn respond(name: Option<String>) -> bool {
    let sender = PENDING.lock().unwrap_or_else(|e| e.into_inner()).take();
    sender.is_some_and(|sender| sender.send(name).is_ok())
}

// --- the app as a host ------------------------------------------------------

/// The open vault, as [`Host`] sees it.
pub struct AppHost(pub AppHandle);

impl Host for AppHost {
    fn database_hash(&self) -> Option<String> {
        let state = self.0.state::<AppState>();
        let unlocked = state.session.lock().unwrap().is_unlocked();
        if !unlocked {
            return None;
        }
        // The workspace, not the vault's sync id: every vault has one from
        // its first open, and the extension's association follows it.
        let id = crate::workspace::active_id(&self.0);
        Some(hex::encode(Sha256::digest(id.as_bytes())))
    }

    fn clients(&self) -> Vec<Client> {
        settings::current(&self.0)
            .browser
            .clients
            .into_iter()
            .map(|c| Client {
                name: c.name,
                key: c.key,
            })
            .collect()
    }

    fn associate(&self, key: &str) -> Option<String> {
        ask(&self.0, key)
    }

    fn remember(&self, client: Client) {
        let mut browser = settings::current(&self.0).browser;
        if browser.clients.iter().any(|c| c.key == client.key) {
            return;
        }
        browser.clients.push(BrowserClient {
            name: client.name,
            key: client.key,
        });
        if let Err(e) = settings::set(&self.0, &json!({ "browser": browser })) {
            log::warn!("browser host: could not remember the extension: {e}");
        }
    }

    fn logins_for(&self, host: &str) -> Vec<Login> {
        let state = self.0.state::<AppState>();
        let session = state.session.lock().unwrap();
        let (Ok(cipher), Ok(store)) = (session.payload_cipher(), session.store()) else {
            return Vec::new();
        };
        let metas = match store.list() {
            Ok(metas) => metas,
            Err(e) => {
                log::warn!("browser host: could not list the vault: {e}");
                return Vec::new();
            }
        };
        let mut logins = Vec::new();
        for meta in metas
            .iter()
            .filter(|m| m.kind == "login" && actions::host_matches(host, &m.url_host))
        {
            let Ok(Some(record)) = store.get(&meta.id) else {
                continue;
            };
            let Ok(entry) = cipher.unseal(&record.id, &record.payload) else {
                log::warn!("browser host: entry {} does not open", meta.id);
                continue;
            };
            let username = entry
                .username
                .clone()
                .filter(|u| !u.is_empty())
                .or(entry.email.clone())
                .unwrap_or_default();
            let totp = entry
                .otp
                .as_deref()
                .filter(|otp| !otp.is_empty())
                .and_then(|otp| commands::generator::generate_otp(otp.to_string()).ok())
                .map(|otp| otp.code);
            logins.push(Login {
                id: entry.id.clone(),
                title: entry.title.clone(),
                username,
                password: entry.password.clone().unwrap_or_default(),
                totp,
            });
        }
        logins
    }

    fn totp(&self, id: &str) -> Option<String> {
        let state = self.0.state::<AppState>();
        let session = state.session.lock().unwrap();
        let cipher = session.payload_cipher().ok()?;
        let record = session.store().ok()?.get(id).ok()??;
        let entry = cipher.unseal(&record.id, &record.payload).ok()?;
        let otp = entry.otp.as_deref().filter(|otp| !otp.is_empty())?;
        commands::generator::generate_otp(otp.to_string())
            .ok()
            .map(|otp| otp.code)
    }

    fn generate_password(&self) -> Option<String> {
        let defaults = settings::current(&self.0).generator;
        commands::generator::generate_password(GeneratorOptions {
            length: defaults.length,
            numbers: defaults.numbers,
            symbols: defaults.symbols,
            uppercase: defaults.uppercase,
            lowercase: Some(defaults.lowercase),
            exclude: Some(defaults.exclude),
            exclude_similar_characters: Some(defaults.exclude_similar_characters),
            strict: Some(true),
        })
        .ok()
    }

    fn lock(&self) {
        session::lock(&self.0);
    }

    fn unlock_requested(&self) {
        window::raise(&self.0);
    }
}
