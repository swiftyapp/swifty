//! Optional additional vaults ("workspaces").
//!
//! A workspace is a whole encrypted database with its own master password. The
//! capability is opt-in and costs an untouched install nothing: the primary
//! workspace *is* the existing data dir, so a user who never creates a second
//! one has no extra directory and no `workspaces.json` on disk. Only the
//! registry — which workspaces exist and which one is current — lives outside
//! any vault, and it holds nothing secret: ids and user-chosen labels.
//!
//! Exactly one workspace is unlocked at a time. Switching locks the current one
//! and marks another active; the next unlock opens that one's database.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};
use crate::state::AppState;
use crate::storage;

/// The workspace every install starts with, and the only one that is not held
/// in a subdirectory. Its id is stable and reserved: generated ids are hex.
pub const PRIMARY_ID: &str = "default";

/// The registry, in the root data dir — beside the primary workspace's files
/// rather than inside any workspace, since it is what says where those are.
pub const REGISTRY_FILE: &str = "workspaces.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    /// `None` until the user names it, which is the primary's normal state —
    /// the frontend shows a translated default label rather than a name in
    /// whatever language the install was first run in.
    pub name: Option<String>,
    /// The vault id (see [`crate::store::identity`]) of the vault inside, as of
    /// its last sync or its restore — `None` for a vault that has never had one,
    /// which is a vault with no pack on Drive.
    ///
    /// Recorded here, outside the vault, for one reader: a Drive restore asking
    /// whether the pack it was pointed at is already a workspace on this
    /// device. Every workspace but the active one is locked, and the id inside
    /// a locked vault is unreadable — so without this the check could only see
    /// the open workspace, and a duplicate of a locked one went through. Not a
    /// secret: the same id is the pack's file name in the user's own Drive.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vault_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
    pub active: String,
    pub workspaces: Vec<Workspace>,
}

/// What an install with no registry file means: one workspace, and it is open.
impl Default for Registry {
    fn default() -> Self {
        Self {
            active: PRIMARY_ID.to_string(),
            workspaces: vec![Workspace {
                id: PRIMARY_ID.to_string(),
                name: None,
                vault_id: None,
            }],
        }
    }
}

impl Registry {
    /// Read the registry under `root`, or the single-workspace default.
    ///
    /// Never fails. A missing file is the ordinary case (nobody has made a
    /// second workspace), and a corrupt one must not lock the user out of the
    /// vault they already have: the default still names the primary, whose
    /// database is exactly where it has always been.
    pub fn load(root: &Path) -> Registry {
        let path = root.join(REGISTRY_FILE);
        if !path.exists() {
            return Registry::default();
        }

        let parsed = std::fs::read_to_string(&path)
            .map_err(|e| e.to_string())
            .and_then(|json| serde_json::from_str::<Registry>(&json).map_err(|e| e.to_string()));
        let mut registry = match parsed {
            Ok(registry) => registry,
            Err(e) => {
                log::warn!(
                    "cannot read {}: {e}; assuming one workspace",
                    path.display()
                );
                return Registry::default();
            }
        };

        // An `active` naming a workspace that is not in the list would resolve
        // to a directory nothing created. The primary always opens.
        if !registry.workspaces.iter().any(|w| w.id == registry.active) {
            registry.active = PRIMARY_ID.to_string();
        }
        registry
    }

    pub fn save(&self, root: &Path) -> Result<()> {
        storage::atomic_write_file(&root.join(REGISTRY_FILE), &serde_json::to_string(self)?)
    }

    pub fn contains(&self, id: &str) -> bool {
        self.workspaces.iter().any(|w| w.id == id)
    }

    /// The workspace other than `except` that holds the vault with this id, if
    /// the registry knows of one. What a Drive restore asks before adding a
    /// second workspace for a pack this device already syncs (see
    /// [`Workspace::vault_id`] for why the registry is what knows).
    pub fn holder_of(&self, vault_id: &str, except: &str) -> Option<&Workspace> {
        self.workspaces
            .iter()
            .find(|w| w.id != except && w.vault_id.as_deref() == Some(vault_id))
    }
}

/// Remember which vault the active workspace holds, once a sync has settled it.
///
/// Called from inside a sync run, at the moment the id is proved to be this
/// vault's (see `sync::run`), so the registry learns of every vault that has a
/// pack on Drive — which is exactly the set a restore could duplicate. A no-op
/// when the record is already right, so a run does not rewrite the file.
///
/// Under `workspace_lock`, as every registry writer is: a rename or a create
/// landing beside this must not save a copy that lacks the other's change.
pub fn record_vault_id(app: &AppHandle, vault_id: &str) -> Result<()> {
    update_active(app, |workspace| {
        if workspace.vault_id.as_deref() == Some(vault_id) {
            return false;
        }
        workspace.vault_id = Some(vault_id.to_string());
        true
    })
}

/// Mirror a name a sync just adopted from another device into the registry.
///
/// The vault carries its own name (see [`crate::store::identity`]), but the
/// workspace list and the header read the registry — every workspace but the
/// active one is locked, so the registry is the only copy they can reach.
pub fn record_vault_name(app: &AppHandle, name: &str) -> Result<()> {
    update_active(app, |workspace| {
        if workspace.name.as_deref() == Some(name) {
            return false;
        }
        workspace.name = Some(name.to_string());
        true
    })
}

/// The active workspace's registry label, if it has one.
pub fn active_name(app: &AppHandle) -> Option<String> {
    let root = storage::root_dir(app).ok()?;
    let state = app.state::<AppState>();
    let _paths = state.workspace_lock.lock().unwrap();
    let active = state.active_workspace.lock().unwrap().clone();
    Registry::load(&root)
        .workspaces
        .into_iter()
        .find(|w| w.id == active)
        .and_then(|w| w.name)
}

/// Change the active workspace's registry entry, saving only if `change`
/// reports it changed something — so a sync run does not rewrite the file on
/// every pass.
fn update_active(app: &AppHandle, change: impl FnOnce(&mut Workspace) -> bool) -> Result<()> {
    let root = storage::root_dir(app)?;
    let state = app.state::<AppState>();
    let _paths = state.workspace_lock.lock().unwrap();
    let active = state.active_workspace.lock().unwrap().clone();
    let mut registry = Registry::load(&root);
    let Some(workspace) = registry.workspaces.iter_mut().find(|w| w.id == active) else {
        return Err(Error::NotFound);
    };
    if !change(workspace) {
        return Ok(());
    }
    registry.save(&root)
}

/// Where a workspace's vault lives.
///
/// The primary is the root itself, not `root/workspaces/default`: that is what
/// makes this change cost existing installs nothing — no migration, no moved
/// files, and a build without workspaces reads the same paths it always did.
pub fn dir_of(root: &Path, id: &str) -> PathBuf {
    if id == PRIMARY_ID {
        root.to_path_buf()
    } else {
        root.join("workspaces").join(id)
    }
}

/// Which workspace the app's paths currently resolve to.
pub fn active_id(app: &AppHandle) -> String {
    app.state::<AppState>()
        .active_workspace
        .lock()
        .unwrap()
        .clone()
}

pub fn is_primary(app: &AppHandle) -> bool {
    active_id(app) == PRIMARY_ID
}

/// Refuse a feature that is still single-vault.
///
/// Biometric unlock alone, now that sync is per-workspace: the enrolled key is
/// one keychain item under a fixed service and account name, so a second
/// workspace enrolling would overwrite the primary's rather than get its own.
pub fn guard_primary(app: &AppHandle) -> Result<()> {
    if is_primary(app) {
        Ok(())
    } else {
        Err(Error::PrimaryWorkspaceOnly)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn tmp_root() -> PathBuf {
        static N: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "rowel-workspace-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_root_with_no_registry_file_is_one_active_primary() {
        let registry = Registry::load(&tmp_root());
        assert_eq!(registry, Registry::default());
        assert_eq!(registry.active, PRIMARY_ID);
        assert_eq!(registry.workspaces.len(), 1);
        assert_eq!(registry.workspaces[0].name, None);
    }

    #[test]
    fn save_and_load_round_trip() {
        let root = tmp_root();
        let saved = Registry {
            active: "a1b2".into(),
            workspaces: vec![
                Workspace {
                    id: PRIMARY_ID.into(),
                    name: None,
                    vault_id: None,
                },
                Workspace {
                    id: "a1b2".into(),
                    name: Some("Work".into()),
                    vault_id: Some("cafe".into()),
                },
            ],
        };
        saved.save(&root).unwrap();
        assert_eq!(Registry::load(&root), saved);
    }

    // A registry written before vault ids were recorded still reads, and a
    // workspace with no id is not written with a `null` for one.
    #[test]
    fn a_vault_id_is_optional_on_disk() {
        let root = tmp_root();
        fs::write(
            root.join(REGISTRY_FILE),
            r#"{"active":"default","workspaces":[{"id":"default","name":null}]}"#,
        )
        .unwrap();
        let loaded = Registry::load(&root);
        assert_eq!(loaded.workspaces[0].vault_id, None);

        loaded.save(&root).unwrap();
        let json = fs::read_to_string(root.join(REGISTRY_FILE)).unwrap();
        assert!(!json.contains("vaultId"), "{json}");
    }

    // The question a restore asks: is this pack already a workspace here — any
    // workspace but the one asking, which the caller has already compared live.
    #[test]
    fn the_holder_of_a_vault_is_any_other_workspace_recording_its_id() {
        let registry = Registry {
            active: PRIMARY_ID.into(),
            workspaces: vec![
                Workspace {
                    id: PRIMARY_ID.into(),
                    name: None,
                    vault_id: Some("cafe".into()),
                },
                Workspace {
                    id: "a1b2".into(),
                    name: Some("Work".into()),
                    vault_id: None,
                },
            ],
        };
        // Held by the primary, asked from the other workspace.
        assert_eq!(
            registry.holder_of("cafe", "a1b2").map(|w| w.id.as_str()),
            Some(PRIMARY_ID)
        );
        // The asking workspace does not count as a holder of its own vault.
        assert_eq!(registry.holder_of("cafe", PRIMARY_ID), None);
        // Nobody recorded this one; a workspace that never synced has no id.
        assert_eq!(registry.holder_of("beef", "a1b2"), None);
    }

    #[test]
    fn an_active_nobody_created_falls_back_to_the_primary() {
        let root = tmp_root();
        Registry {
            active: "gone".into(),
            workspaces: vec![Workspace {
                id: PRIMARY_ID.into(),
                name: None,
                vault_id: None,
            }],
        }
        .save(&root)
        .unwrap();

        // The list is kept as written; only the dangling pointer into it moves.
        let loaded = Registry::load(&root);
        assert_eq!(loaded.active, PRIMARY_ID);
        assert_eq!(loaded.workspaces.len(), 1);
    }

    #[test]
    fn unparseable_json_reads_as_a_single_workspace_rather_than_failing() {
        let root = tmp_root();
        fs::write(root.join(REGISTRY_FILE), "{ not json").unwrap();
        assert_eq!(Registry::load(&root), Registry::default());
    }

    #[test]
    fn the_primary_is_the_root_and_everything_else_is_a_subdirectory() {
        let root = Path::new("/data");
        assert_eq!(dir_of(root, PRIMARY_ID), root);
        assert_eq!(dir_of(root, "a1b2"), root.join("workspaces").join("a1b2"));
    }
}
