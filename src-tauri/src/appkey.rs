//! The app-level unlock: every workspace's key, held once the app is open.
//!
//! One password, or one biometric prompt, opens the whole device. The primary
//! workspace's key is the *app key*: every other workspace keeps a copy of its
//! own key sealed under it, in a sidecar beside its database
//! ([`storage::WRAPPED_KEY_FILE`]), so opening the primary opens them all —
//! without an Argon2id run per workspace, and without a biometric prompt per
//! workspace. The sidecar is local to this device on purpose: the pack a
//! workspace syncs stays under its own password-derived key, so another device
//! restores it with a password exactly as before, and the app key differs from
//! device to device (each has its own primary and its own salt).
//!
//! What is held here is key *material* rather than a [`VaultKey`]: the same
//! opaque bytes the biometric store keeps, interpreted by sidecar presence when
//! a database is opened with them ([`VaultKey::from_material`]).
//!
//! The ring outlives a workspace switch — that is its whole point — and ends
//! with every lock (`session::lock`), the auto-lock included. It is filled by
//! whichever unlock happens first: a primary unlock unwraps every sidecar; a
//! non-primary unlock adds its own key, and writes its sidecar once the app key
//! is known ([`adopt`]).

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{AppHandle, Manager};
use zeroize::Zeroizing;

use crate::crypto::{self, VaultKey};
use crate::error::{Error, Result};
use crate::state::AppState;
use crate::storage;
use crate::workspace::{self, Registry, PRIMARY_ID};

/// The keys of every workspace the app has open, by workspace id.
#[derive(Default)]
pub struct Keyring {
    keys: HashMap<String, Zeroizing<Vec<u8>>>,
}

impl Keyring {
    pub fn insert(&mut self, id: &str, material: &[u8]) {
        self.keys
            .insert(id.to_string(), Zeroizing::new(material.to_vec()));
    }

    /// A scrubbed copy of one workspace's key material.
    pub fn get(&self, id: &str) -> Option<Zeroizing<Vec<u8>>> {
        self.keys.get(id).cloned()
    }

    pub fn has(&self, id: &str) -> bool {
        self.keys.contains_key(id)
    }

    pub fn remove(&mut self, id: &str) -> Option<Zeroizing<Vec<u8>>> {
        self.keys.remove(id)
    }

    /// Drop every key. Says whether there was anything to drop, so a lock can
    /// tell an app that was open at this level from one that was not.
    pub fn clear(&mut self) -> bool {
        let held = !self.keys.is_empty();
        self.keys.clear();
        held
    }

    pub fn is_empty(&self) -> bool {
        self.keys.is_empty()
    }

    /// The app key: the primary's material, if the primary has been opened.
    pub fn app_key(&self) -> Option<Zeroizing<Vec<u8>>> {
        self.get(PRIMARY_ID)
    }

    /// Every workspace but the primary, with its material.
    fn others(&self) -> Vec<(String, Zeroizing<Vec<u8>>)> {
        self.keys
            .iter()
            .filter(|(id, _)| id.as_str() != PRIMARY_ID)
            .map(|(id, material)| (id.clone(), material.clone()))
            .collect()
    }
}

// --- the sidecar ---------------------------------------------------------------

// A subkey of the app key, so the bytes that seal the sidecars are never the
// bytes that open the primary's database or its payloads.
const INFO_WRAP: &[u8] = b"workspace-key-wrap";

fn wrapping_key(app_key: &[u8]) -> Zeroizing<[u8; crypto::KEY_LEN]> {
    Zeroizing::new(crypto::hkdf_subkey(app_key, INFO_WRAP))
}

fn sidecar(root: &Path, id: &str) -> std::path::PathBuf {
    workspace::dir_of(root, id).join(storage::WRAPPED_KEY_FILE)
}

/// Whether workspace `id` has a key sealed under the app key on this device —
/// what the launch probe asks to say whether a biometric unlock can open it.
pub fn is_wrapped(root: &Path, id: &str) -> bool {
    id != PRIMARY_ID && sidecar(root, id).exists()
}

/// Seal workspace `id`'s key under the app key, beside its database. Bound to
/// the workspace id, so a sidecar copied under another workspace's directory
/// does not open there.
fn wrap(root: &Path, id: &str, app_key: &[u8], material: &[u8]) -> Result<()> {
    let sealed = crypto::seal_aead(&*wrapping_key(app_key), id.as_bytes(), material)?;
    storage::atomic_write_private(&sidecar(root, id), STANDARD.encode(sealed).as_bytes())
}

/// The key sealed for workspace `id`, if it has a sidecar the app key opens.
///
/// A sidecar the app key does *not* open is stale — sealed under an app key
/// this device no longer has, which is what deleting the primary leaves behind
/// — and is removed, so the next unlock of that workspace writes a fresh one
/// rather than the probe offering a biometric unlock that cannot work.
fn unwrap(root: &Path, id: &str, app_key: &[u8]) -> Result<Option<Zeroizing<Vec<u8>>>> {
    let path = sidecar(root, id);
    if !path.exists() {
        return Ok(None);
    }
    let sealed = STANDARD
        .decode(fs::read_to_string(&path)?.trim())
        .map_err(|e| Error::Crypto(e.to_string()))?;
    match crypto::unseal_aead(&*wrapping_key(app_key), id.as_bytes(), &sealed) {
        Ok(material) => Ok(Some(Zeroizing::new(material))),
        Err(e) => {
            log::warn!("workspace {id}'s sealed key does not open under the app key; removing it");
            let _ = fs::remove_file(&path);
            Err(e)
        }
    }
}

// --- filling the ring ------------------------------------------------------------

/// The primary has been opened: its key is the app key, and every workspace
/// with a sidecar it opens joins the ring with it. Best effort per workspace —
/// one that will not open is left for its own password.
///
/// A workspace already in the ring — opened with its own password before the
/// primary was, with no app key to seal it under at the time — is sealed now,
/// which is the moment its password and the app key are first both known.
pub fn open_all(app: &AppHandle, app_key: &[u8]) {
    let state = app.state::<AppState>();
    let Ok(root) = storage::root_dir(app) else {
        return;
    };
    let mut ring = state.keyring.lock().unwrap();
    ring.insert(PRIMARY_ID, app_key);
    for workspace in Registry::load(&root).workspaces {
        if workspace.id == PRIMARY_ID {
            continue;
        }
        match ring.get(&workspace.id) {
            Some(material) => {
                if let Err(e) = wrap(&root, &workspace.id, app_key, &material) {
                    log::warn!(
                        "could not seal workspace {}'s key under the app key: {e}",
                        workspace.id
                    );
                }
            }
            None => {
                if let Ok(Some(material)) = unwrap(&root, &workspace.id, app_key) {
                    ring.insert(&workspace.id, &material);
                }
            }
        }
    }
}

/// A workspace other than the primary has been opened with its own key: it
/// joins the ring, and — when the app key is known — its sidecar is written so
/// the next app unlock opens it too. Without the app key the sidecar waits for
/// an unlock that has it (see `commands::auth::unlock`).
pub fn adopt(app: &AppHandle, id: &str, material: &[u8]) {
    if id == PRIMARY_ID {
        open_all(app, material);
        return;
    }
    let state = app.state::<AppState>();
    let mut ring = state.keyring.lock().unwrap();
    ring.insert(id, material);
    let Some(app_key) = ring.app_key() else {
        return;
    };
    drop(ring);
    if let Ok(root) = storage::root_dir(app) {
        if let Err(e) = wrap(&root, id, &app_key, material) {
            log::warn!("could not seal workspace {id}'s key under the app key: {e}");
        }
    }
}

/// The app key changed — a master-password change on the primary, or another
/// workspace promoted into its place — and every sidecar sealed under the old
/// one is stale. Rewritten for every workspace whose key is in the ring; the
/// rest are removed by the next `open_all` when they fail to open.
pub fn rewrap_all(app: &AppHandle) {
    let state = app.state::<AppState>();
    let ring = state.keyring.lock().unwrap();
    let Some(app_key) = ring.app_key() else {
        return;
    };
    let others = ring.others();
    drop(ring);
    let Ok(root) = storage::root_dir(app) else {
        return;
    };
    for (id, material) in others {
        if let Err(e) = wrap(&root, &id, &app_key, &material) {
            log::warn!("could not reseal workspace {id}'s key under the new app key: {e}");
        }
    }
}

/// Open the primary's sealed copy of workspace `id`'s key with `app_key`, as a
/// [`VaultKey`] ready to open that workspace's database. `None` when it has no
/// sidecar, or one the app key does not open.
pub fn unwrap_key(root: &Path, id: &str, app_key: &[u8]) -> Option<VaultKey> {
    let material = unwrap(root, id, app_key).ok()??;
    Some(VaultKey::from_material(
        material,
        workspace::dir_of(root, id)
            .join(storage::KDF_SIDECAR_FILE)
            .exists(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_root() -> std::path::PathBuf {
        static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "rowel-keyring-{}-{}",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    const APP_KEY: &[u8] = &[7u8; 32];

    #[test]
    fn a_wrapped_key_round_trips_under_the_app_key() {
        let root = tmp_root();
        wrap(&root, "a1b2", APP_KEY, b"vault-key").unwrap();

        assert!(is_wrapped(&root, "a1b2"));
        assert_eq!(
            &**unwrap(&root, "a1b2", APP_KEY).unwrap().unwrap(),
            b"vault-key"
        );
    }

    #[test]
    fn a_workspace_without_a_sidecar_has_nothing_to_unwrap() {
        let root = tmp_root();
        assert!(!is_wrapped(&root, "a1b2"));
        assert!(unwrap(&root, "a1b2", APP_KEY).unwrap().is_none());
    }

    // Deleting the primary leaves every sidecar sealed under a key this device
    // no longer has. Such a sidecar is an error to open, and it goes.
    #[test]
    fn a_sidecar_under_another_app_key_is_stale_and_removed() {
        let root = tmp_root();
        wrap(&root, "a1b2", APP_KEY, b"vault-key").unwrap();

        assert!(unwrap(&root, "a1b2", &[9u8; 32]).is_err());
        assert!(!is_wrapped(&root, "a1b2"));
    }

    // The id is authenticated: a sidecar moved under another workspace's
    // directory must not open there.
    #[test]
    fn a_sidecar_is_bound_to_its_workspace() {
        let root = tmp_root();
        wrap(&root, "a1b2", APP_KEY, b"vault-key").unwrap();
        fs::create_dir_all(workspace::dir_of(&root, "c3d4")).unwrap();
        fs::rename(sidecar(&root, "a1b2"), sidecar(&root, "c3d4")).unwrap();

        assert!(unwrap(&root, "c3d4", APP_KEY).is_err());
    }

    #[test]
    fn the_primary_is_never_wrapped() {
        let root = tmp_root();
        assert!(!is_wrapped(&root, PRIMARY_ID));
    }

    #[test]
    fn the_ring_tells_the_app_key_from_the_rest() {
        let mut ring = Keyring::default();
        assert!(ring.app_key().is_none());
        ring.insert("a1b2", b"a");
        ring.insert(PRIMARY_ID, b"p");

        assert_eq!(&**ring.app_key().unwrap(), b"p");
        assert_eq!(ring.others().len(), 1);
        assert!(ring.clear());
        assert!(!ring.clear());
    }
}
