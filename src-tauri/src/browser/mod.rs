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
//! extension gets in once per vault, by the user naming it in a dialog; after
//! that its identification key, kept inside that vault, is what it proves
//! itself with — to that vault, and to no other workspace on the device.

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
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

pub use self::actions::Client;
use self::actions::{Host, Login};
use self::protocol::Code;
use crate::error::Result;
use crate::models::GeneratorOptions;
use crate::settings;
use crate::state::AppState;
use crate::store::{SqliteStore, VaultStore};
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

// --- the extensions let in ------------------------------------------------------
//
// A `meta` row of the vault they were let into, sealed with the rest of it.
// In the vault rather than in `settings.json` for two reasons. The key is the
// whole credential — the protocol never asks the extension to sign with the
// private half — so on disk it must be as unreadable as what it opens. And an
// association is to one vault: the extension keys its own copy by the vault
// hash, and a workspace the user never let it into must not answer to it.
// Every read and write happens under the session lock, so two approvals
// cannot each write a list that misses the other's.

const CLIENTS_META: &str = "browser_clients";

fn clients_in(store: &SqliteStore) -> Vec<Client> {
    store
        .meta_get(CLIENTS_META)
        .ok()
        .flatten()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn write_clients(store: &SqliteStore, clients: &[Client]) -> Result<()> {
    store
        .meta_set(CLIENTS_META, &serde_json::to_string(clients)?)
        .map_err(session::store_err)
}

/// The extensions let into the open vault; none while it is locked.
pub fn clients(app: &AppHandle) -> Vec<Client> {
    let state = app.state::<AppState>();
    let session = state.session.lock().unwrap();
    session.store().map(clients_in).unwrap_or_default()
}

/// Take an extension's access to the open vault back.
pub fn forget(app: &AppHandle, key: &str) -> Result<()> {
    let state = app.state::<AppState>();
    let session = state.session.lock().unwrap();
    let store = session.store()?;
    let mut clients = clients_in(store);
    clients.retain(|c| c.key != key);
    write_clients(store, &clients)
}

// --- the app as a host ------------------------------------------------------

/// The open vault, as [`Host`] sees it.
pub struct AppHost(pub AppHandle);

impl Host for AppHost {
    fn enabled(&self) -> bool {
        settings::current(&self.0).browser.enabled
    }

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
        clients(&self.0)
    }

    // The user is asked with the session lock let go — they may take a
    // minute — so the vault that asked is remembered by its epoch, and the
    // key is written only if that is still the vault open when they answer.
    // A workspace switch in between makes the approval nobody's: the vault
    // it was given for is closed, and the one now open was never asked for.
    fn associate(&self, key: &str) -> std::result::Result<String, Code> {
        let state = self.0.state::<AppState>();
        let epoch = commands::unlocked_epoch(&state).map_err(|_| Code::DatabaseNotOpened)?;
        let name = ask(&self.0, key).ok_or(Code::ActionCancelledOrDenied)?;
        let session = state.session.lock().unwrap();
        let store = session.store_at(epoch).map_err(|_| {
            log::warn!("browser host: the vault changed hands while the user was asked");
            Code::AssociationFailed
        })?;
        let mut clients = clients_in(store);
        if !clients.iter().any(|c| c.key == key) {
            clients.push(Client {
                name: name.clone(),
                key: key.to_string(),
            });
            write_clients(store, &clients).map_err(|e| {
                log::warn!("browser host: could not remember the extension: {e}");
                Code::AssociationFailed
            })?;
        }
        Ok(name)
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
