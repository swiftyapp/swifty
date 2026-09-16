//! Creating, switching and renaming workspaces.
//!
//! Only one workspace is ever unlocked, so every command here starts by
//! clearing the session: switching *is* locking what is open and pointing the
//! paths somewhere else. None of them emit events — the frontend drives the
//! switch and re-probes `app_status` afterwards.

use std::fs;
use std::sync::atomic::Ordering;

use rand::RngCore;
use tauri::{AppHandle, State};

use crate::error::{Error, Result};
use crate::models::UnlockResult;
use crate::session::Session;
use crate::state::AppState;
use crate::storage;
use crate::workspace::{self, Registry, Workspace};

use super::setup::{begin_step, create_off_thread};

const SYNC_BUSY: &str = "wait for the sync in progress to finish";

/// Lock whatever is open and make `id` the workspace the app addresses.
///
/// The next unlock opens its database, and a relaunch comes back to it: the
/// choice is recorded in the registry, not just in memory.
#[tauri::command]
pub fn workspace_select(id: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    // The step a create holds while its Argon2 runs, and a master-password
    // change while it rewrites the sidecar: both write through the paths, so
    // neither may see them move underneath.
    let _step = begin_step(&state)?;
    let root = storage::root_dir(&app)?;
    let mut registry = Registry::load(&root);
    if !registry.contains(&id) {
        return Err(Error::NotFound);
    }

    let _paths = state.workspace_lock.lock().unwrap();
    guard_sync_idle(&state)?;

    // Persist first: a save that fails leaves the session open and the paths
    // where they were, so a rejected switch changes nothing. Nothing to record
    // when the choice did not change, which on a single-workspace install is
    // the only case there is — so selecting the primary never conjures a
    // registry file for a user who has no second vault.
    if registry.active != id {
        registry.active = id.clone();
        registry.save(&root)?;
    }

    // Together, and in this order: a session outliving the switch would hold
    // one workspace's key against another's database.
    state.session.lock().unwrap().clear();
    *state.active_workspace.lock().unwrap() = id;
    Ok(())
}

/// Refuse to move the paths while a sync flow is using them. The caller holds
/// `workspace_lock`, which is also what every flow raises its flag under — so
/// what this reads cannot change between the check and the move.
///
/// A consent flow keeps the cryptor of the vault that started it, and a run
/// writes its scratch and tokens through the *active* workspace's paths — so a
/// switch mid-flight would seal one workspace's account under another's
/// directory, and the next sync from there would publish into the wrong pack.
fn guard_sync_idle(state: &AppState) -> Result<()> {
    let run = state.sync_run.lock().unwrap();
    let busy = state.syncing.load(Ordering::SeqCst) || run.pending || run.in_progress;
    #[cfg(mobile)]
    let busy = busy || state.pending_auth.lock().unwrap().is_some();
    if busy {
        return Err(Error::Other(SYNC_BUSY.into()));
    }
    Ok(())
}

/// Put back what `workspace_create` took out: the session that was open and
/// the workspace the paths pointed at. Under the lock, as one step, for the
/// same reason they came out as one.
fn restore(state: &AppState, active: String, session: Session) {
    let _paths = state.workspace_lock.lock().unwrap();
    *state.active_workspace.lock().unwrap() = active;
    *state.session.lock().unwrap() = session;
}

/// Create a workspace with its own master password and leave it unlocked.
///
/// The new vault is empty and unsynced by construction, so the result needs no
/// listing or token probe — it is what the caller of a first unlock expects,
/// with nothing in it yet.
#[tauri::command]
pub async fn workspace_create(
    name: String,
    password: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(Error::Other("a workspace needs a name".into()));
    }
    if password.is_empty() {
        return Err(Error::Other("a workspace needs a master password".into()));
    }
    // The same exclusion first-run setup takes: this writes a KDF sidecar and a
    // database, and two of those interleaving would pair one with the other's.
    // Also what keeps `workspace_select` out until the vault below exists.
    let _step = begin_step(&state)?;

    let root = storage::root_dir(&app)?;
    let id = new_id();

    // The open session comes out and the paths move as one step under the lock,
    // so no command sees one workspace's key beside another's directory. The
    // session is kept rather than dropped: a failure puts it back exactly as it
    // was, and the frontend — which only changes screens on success — is still
    // looking at a vault that is still open.
    let (previous_active, previous_session) = {
        let _paths = state.workspace_lock.lock().unwrap();
        guard_sync_idle(&state)?;
        let session = std::mem::take(&mut *state.session.lock().unwrap());
        let active = std::mem::replace(&mut *state.active_workspace.lock().unwrap(), id.clone());
        (active, session)
    };

    let created = match create_vault_in(&app, &root, &id, password).await {
        Ok(created) => created,
        Err(e) => {
            // Leave no trace of a workspace that never opened: the user is put
            // back exactly where they pressed the button, free to try again.
            discard(&root, &id);
            restore(&state, previous_active, previous_session);
            return Err(e);
        }
    };

    // Registry last: an entry is recorded only once there is a vault behind it,
    // so a failure anywhere above has nothing on record to undo. If this write
    // fails the vault goes too — a database no registry names would otherwise
    // be one with no way back to it.
    let mut registry = Registry::load(&root);
    registry.workspaces.push(Workspace {
        id: id.clone(),
        name: Some(name),
    });
    registry.active = id.clone();
    if let Err(e) = registry.save(&root) {
        // The store closes before its files are removed.
        drop(created);
        discard(&root, &id);
        restore(&state, previous_active, previous_session);
        return Err(e);
    }

    let (key, store) = created;
    state.session.lock().unwrap().set(key, store, false);
    Ok(UnlockResult {
        entries: vec![],
        sync_configured: false,
    })
}

/// Give a workspace a (new) label. Ids never change; only this does.
#[tauri::command]
pub fn workspace_rename(id: String, name: String, app: AppHandle) -> Result<()> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(Error::Other("a workspace needs a name".into()));
    }

    let root = storage::root_dir(&app)?;
    let mut registry = Registry::load(&root);
    let workspace = registry
        .workspaces
        .iter_mut()
        .find(|w| w.id == id)
        .ok_or(Error::NotFound)?;
    workspace.name = Some(name);
    registry.save(&root)
}

// Argon2id + creating the encrypted DB, off the command thread. The directory
// comes first: `create_vault` writes the KDF sidecar before SQLCipher opens
// anything, and the sidecar must land in the new workspace, not beside it.
async fn create_vault_in(
    app: &AppHandle,
    root: &std::path::Path,
    id: &str,
    password: String,
) -> Result<(crate::crypto::VaultKey, crate::store::SqliteStore)> {
    let dir = workspace::dir_of(root, id);
    fs::create_dir_all(&dir)?;
    // Same mode `SqliteStore::open` gives the directory it creates.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    create_off_thread(app, password).await
}

// Undo everything `create_vault_in` may have written.
fn discard(root: &std::path::Path, id: &str) {
    let dir = workspace::dir_of(root, id);
    storage::remove_db_files(&dir.join(storage::DB_FILE));
    let _ = fs::remove_file(dir.join(storage::KDF_SIDECAR_FILE));
    let _ = fs::remove_dir_all(&dir);
}

// A workspace id is a directory name and nothing more: it is never shown, never
// typed, and only has to be unique and filesystem-safe. 128 random bits of hex
// is that, without a uuid dependency for it.
fn new_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}
