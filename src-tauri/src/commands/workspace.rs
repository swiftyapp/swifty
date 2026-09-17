//! Creating, restoring, switching and renaming workspaces.
//!
//! Only one workspace is ever unlocked, so every command here starts by
//! clearing the session: switching *is* locking what is open and pointing the
//! paths somewhere else. A switch therefore announces itself as the lock it is
//! (`vault:locked`), which is what re-probes `app_status` on the frontend;
//! creating one ends unlocked and has nothing to announce.
//!
//! A workspace can also arrive from Drive rather than be made here. That flow
//! borrows onboarding's keyless connect (`commands::setup`) wholesale — the
//! tokens it leaves pending, the probe, the events — and differs only in where
//! the restored vault lands and in what has to be put back when it fails. Or
//! it arrives from the account the open workspace already syncs to, with no
//! sign-in at all: every device connected to an account is meant to hold every
//! vault in it, so the account's other vaults are offered after each sync
//! (`sync::publish_remote_vaults`) and restored with the open workspace's own
//! tokens. A workspace *made* on a connected device inherits the account the
//! same way, and syncs to it as a vault of its own.

use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;

use tauri::{AppHandle, State};
use zeroize::Zeroizing;

use crate::crypto::VaultKey;
use crate::error::{Error, Result};
use crate::models::{EntryMetaDto, UnlockResult};
use crate::session::{list_metas, store_err, Lease};
use crate::state::AppState;
use crate::storage;
use crate::store::SqliteStore;
use crate::sync::{self, restore};
use crate::workspace::{self, Registry, Workspace};

use super::setup::{self, begin_step, create_off_thread};

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

    // Read under the lock too: every writer of the registry holds it, so what is
    // saved below is a change to the current file, never to a stale copy.
    let _paths = state.workspace_lock.lock().unwrap();
    let mut registry = Registry::load(&root);
    if !registry.contains(&id) {
        return Err(Error::NotFound);
    }
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
    // Ended like any other session: clipboard cleared, idle timer dropped.
    crate::session::sealed(&app);
    // Sync is per workspace, and what the frontend is holding belongs to the one
    // that just locked. Said now rather than left to the re-probe below, so no
    // frame shows another vault's "last synced" or another vault's error.
    super::sync::switched(&app);
    // Announced like any other lock, so the frontend takes the one path it
    // takes for all of them. After the repoint rather than inside the clear
    // (`session::lock`): the reaction re-probes `app_status`, which must find
    // the new workspace already active.
    crate::events::vault_locked(&app);
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
    // The active workspace's run state is the only one that can have a flow in
    // it: starting one takes the lock this caller is holding.
    let busy = state.syncing.load(Ordering::SeqCst)
        || state.sync_run(|run| run.pending || run.in_progress);
    #[cfg(mobile)]
    let busy = busy || state.pending_auth.lock().unwrap().is_some();
    if busy {
        return Err(Error::SyncBusy);
    }
    Ok(())
}

/// Load, change and save the registry as one step under the workspace lock, so
/// two writers can never each save a copy that lacks the other's change — a
/// rename landing beside a create would otherwise drop the new workspace from
/// the file and leave its vault with no way back to it after a relaunch.
fn update_registry<T>(
    state: &AppState,
    root: &Path,
    change: impl FnOnce(&mut Registry) -> Result<T>,
) -> Result<T> {
    let _paths = state.workspace_lock.lock().unwrap();
    let mut registry = Registry::load(root);
    let out = change(&mut registry)?;
    registry.save(root)?;
    Ok(out)
}

/// Put back what `workspace_create` took out: the session that was open and
/// the workspace the paths pointed at. Under the lock, as one step, for the
/// same reason they came out as one. The session only goes back if nothing
/// locked it while the lease was out (`Session::restore`); the paths go back
/// regardless, since they are what a later unlock resolves through.
fn restore(state: &AppState, active: String, previous: Lease) {
    let _paths = state.workspace_lock.lock().unwrap();
    *state.active_workspace.lock().unwrap() = active;
    state.session.lock().unwrap().restore(previous);
}

/// Create a workspace with its own master password and leave it unlocked.
///
/// The new vault is empty, so the result needs no listing — it is what the
/// caller of a first unlock expects, with nothing in it yet.
///
/// It inherits the open workspace's Google account, when there is one: the
/// tokens are sealed under the new key, and the vault is given its id here so
/// that its first sync addresses a pack of its own rather than being turned
/// away as a nameless vault beside the account's others (`sync::plan_vault_id`).
/// That first sync — run by the frontend's `enterMain`, as after the first
/// run's create — is what creates the pack, and what puts the new vault in
/// front of every other device on the account. A workspace made on a device
/// that does not sync is exactly what it was: local, sync off.
#[tauri::command]
pub async fn workspace_create(
    name: String,
    password: Zeroizing<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(Error::WorkspaceNameRequired);
    }
    if password.is_empty() {
        return Err(Error::WorkspacePasswordRequired);
    }
    // The same exclusion first-run setup takes: this writes a KDF sidecar and a
    // database, and two of those interleaving would pair one with the other's.
    // Also what keeps `workspace_select` out until the vault below exists.
    let _step = begin_step(&state)?;

    let root = storage::root_dir(&app)?;
    let id = crate::crypto::random_hex_id();

    // The open session comes out on a lease and the paths move as one step
    // under the lock, so no command sees one workspace's key beside another's
    // directory. The session is kept rather than dropped: a failure puts it
    // back exactly as it was, and the frontend — which only changes screens on
    // success — is still looking at a vault that is still open. A lock that
    // lands while the lease is out wins over both outcomes (`Session::adopt`).
    //
    // The account is read in the same step, before the paths move: the token
    // file resolves through the active workspace, and after the repoint that
    // is the new, empty one.
    let (previous_active, previous, inherited) = {
        let _paths = state.workspace_lock.lock().unwrap();
        guard_sync_idle(&state)?;
        let inherited = open_account(&app, &state);
        let lease = state.session.lock().unwrap().take_out()?;
        let active = std::mem::replace(&mut *state.active_workspace.lock().unwrap(), id.clone());
        (active, lease, inherited)
    };

    let created = match create_vault_in(&app, &root, &id, password, inherited.as_ref()).await {
        Ok(created) => created,
        Err(e) => {
            // Leave no trace of a workspace that never opened: the user is put
            // back exactly where they pressed the button, free to try again.
            discard(&root, &id);
            restore(&state, previous_active, previous);
            return Err(e);
        }
    };
    let (key, store, vault_id) = created;

    // Registry last: an entry is recorded only once there is a vault behind it,
    // so a failure anywhere above has nothing on record to undo. If this write
    // fails the vault goes too — a database no registry names would otherwise
    // be one with no way back to it.
    let recorded = update_registry(&state, &root, |registry| {
        registry.workspaces.push(Workspace {
            id: id.clone(),
            name: Some(name),
            // A vault that will sync is recorded by its id now, as a restored
            // one is: its pack exists after the first run, and the record is
            // what turns a restore of that pack away. A local vault has no id
            // and no pack, so there is nothing to record.
            vault_id: vault_id.clone(),
        });
        registry.active = id.clone();
        Ok(())
    });
    if let Err(e) = recorded {
        // The store closes before its files are removed.
        drop(store);
        discard(&root, &id);
        restore(&state, previous_active, previous);
        return Err(e);
    }

    // The new vault continues the session the previous one was taken from. If
    // that session was locked while the vault was being created, it stays
    // locked: the workspace exists and is recorded, and the next unlock opens
    // it, but it does not open itself behind a lock the user asked for.
    let syncing = inherited.is_some();
    let (_, _, _, claim) = previous.split();
    if !state
        .session
        .lock()
        .unwrap()
        .adopt(claim, key, store, syncing)
    {
        return Err(Error::Locked);
    }
    Ok(UnlockResult {
        entries: vec![],
        sync_configured: syncing,
    })
}

/// The open workspace's Google account, if it has one. Read under the caller's
/// `workspace_lock`, through the paths as they stand.
fn open_account(app: &AppHandle, state: &AppState) -> Option<sync::Tokens> {
    let cryptor = state.session.lock().unwrap().cryptor().ok()?;
    sync::current_tokens(app, &cryptor)
}

/// Connect a Google account for a workspace that does not exist yet.
///
/// Onboarding's connect, reached from Settings instead of from the first run:
/// the tokens are held in memory rather than sealed, because the vault they
/// belong to is still a pack on Drive. Exactly the same events report it, so
/// the picker the first run draws is the picker this draws.
#[cfg(desktop)]
#[tauri::command]
pub fn workspace_drive_connect(app: AppHandle) -> Result<()> {
    setup::connect_pending(&app)
}

/// The mobile twin of [`workspace_drive_connect`].
#[cfg(mobile)]
#[tauri::command]
pub fn workspace_drive_connect(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    setup::connect_pending(&app, &state)
}

/// Add a workspace by restoring one of the connected account's vaults into it.
///
/// The second device's way in to everything onboarding could not reach: a fresh
/// install restores exactly one vault, and every other vault on the same
/// account stayed unreachable until this. Step for step it is
/// [`workspace_create`] with the empty vault swapped for a downloaded pack —
/// the same step lock, the same lease and repoint under `workspace_lock`, the
/// same registry-last ordering, the same unwinding — plus the two things
/// onboarding does after a restore of its own (`commands::setup::adopt`): the
/// vault id taken off the file name, and the pending tokens sealed under the
/// key the restore just derived.
///
/// A wrong password costs nothing but the typing. It surfaces as
/// [`Error::InvalidPassword`] from the pack's own SQLCipher open, the new
/// directory is removed, the workspace the user was in comes back exactly as it
/// was, and the account stays pending — so the retry is one press away.
#[tauri::command]
pub async fn workspace_restore_from_drive(
    name: String,
    password: Zeroizing<String>,
    file_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    let tokens = setup::peek_pending(&state)?;
    restore_workspace(
        &app,
        &state,
        name,
        password,
        file_id,
        tokens,
        Account::Pending,
    )
    .await
}

/// Add a workspace by restoring one of the vaults the open workspace's account
/// holds and this device does not — the ones every sync run reports
/// (`sync::publish_remote_vaults`).
///
/// [`workspace_restore_from_drive`] with the sign-in taken out: the tokens are
/// the open workspace's own, read off its token file, and a copy is sealed
/// under the restored vault's key exactly as a pending account would be. The
/// device ends up with one account in two workspaces, which is what an account
/// connected once is meant to reach. A workspace that does not sync has no
/// account to restore from and is refused before anything is downloaded.
#[tauri::command]
pub async fn workspace_restore_from_account(
    name: String,
    password: Zeroizing<String>,
    file_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<UnlockResult> {
    // Under the lock, as `workspace_create` reads it: the token file resolves
    // through the active workspace, which must not move underneath.
    let tokens = {
        let _paths = state.workspace_lock.lock().unwrap();
        open_account(&app, &state).ok_or(Error::SyncNotConfigured)?
    };
    restore_workspace(&app, &state, name, password, file_id, tokens, Account::Open).await
}

/// Whose tokens a restore runs on, which is the one thing that differs between
/// the two restores: a pending account has to be kept current through the
/// download and dropped once it is sealed inside the new workspace; the open
/// workspace's account is its own to keep, and nothing here touches it.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Account {
    Pending,
    Open,
}

/// Turn the pack `file_id` into a workspace, unlocked with `password`.
async fn restore_workspace(
    app: &AppHandle,
    state: &AppState,
    name: String,
    password: Zeroizing<String>,
    file_id: String,
    mut tokens: sync::Tokens,
    account: Account,
) -> Result<UnlockResult> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(Error::WorkspaceNameRequired);
    }
    if password.is_empty() {
        return Err(Error::WorkspacePasswordRequired);
    }
    // The same exclusion `workspace_create` takes, and for the same files.
    let _step = begin_step(state)?;

    let root = storage::root_dir(app)?;
    let id = crate::crypto::random_hex_id();

    // The download runs *before* the paths move. It is the slow half — a
    // listing, a token refresh and a whole vault over the network — and the
    // session of the workspace the user is looking at would otherwise be held
    // out for all of it, taking a vault away that they never asked to leave.
    let (bytes, vault_id) = setup::download(app, &mut tokens, &file_id, |vault_id| {
        guard_other_vault(state, &root, vault_id)
    })
    .await?;
    // Whatever the refresh produced has to be kept, for the reason onboarding
    // keeps it: Google rotates refresh tokens, and a mistyped master password
    // has to leave a retry that works. The open workspace's own refresh is
    // written back by its next run, as every refresh of its is.
    if account == Account::Pending {
        setup::replace_pending_tokens(&state, tokens.clone())?;
    }

    // As `workspace_create` takes them, and for the same reasons: one step
    // under the lock, the session kept rather than dropped so a failure can put
    // it back, and a lock landing meanwhile winning over both outcomes.
    let (previous_active, previous) = {
        let _paths = state.workspace_lock.lock().unwrap();
        guard_sync_idle(state)?;
        let lease = state.session.lock().unwrap().take_out()?;
        let active = std::mem::replace(&mut *state.active_workspace.lock().unwrap(), id.clone());
        (active, lease)
    };

    let restored = restore_vault_in(app, &root, &id, bytes, password, &vault_id, &tokens).await;
    let (key, store, entries) = match restored {
        Ok(restored) => restored,
        Err(e) => {
            // Leave no trace of a workspace that never opened — the token file
            // the restore may have written goes with the directory.
            discard(&root, &id);
            restore(state, previous_active, previous);
            return Err(e);
        }
    };

    // Registry last, for the reason `workspace_create` records it last: an
    // entry only once there is a vault behind it.
    let recorded = update_registry(state, &root, |registry| {
        registry.workspaces.push(Workspace {
            id: id.clone(),
            name: Some(name),
            // Known now, and this workspace arrives syncing: the record that
            // turns away a second restore of the same pack is made with the
            // first, not left to the sync that follows.
            vault_id: Some(vault_id.clone()),
        });
        registry.active = id.clone();
        Ok(())
    });
    if let Err(e) = recorded {
        // The store closes before its files are removed.
        drop(store);
        discard(&root, &id);
        restore(state, previous_active, previous);
        return Err(e);
    }

    // The account belongs to the new workspace now: its token file is on disk,
    // sealed under the key above, and the registry names the vault it is in.
    // Dropping the in-memory copy is what stops a later restore from silently
    // adopting it — and it goes *before* the adopt below, because a lock that
    // wins there is not a failure of the restore, and must not leave the
    // credentials pending as if it were.
    if account == Account::Pending {
        setup::take_pending(state);
    }

    // The restored vault continues the session the previous one was taken from,
    // and it arrives connected. A lock that landed while the lease was out still
    // wins — the workspace exists and is recorded, and the next unlock opens it.
    let (_, _, _, claim) = previous.split();
    if !state.session.lock().unwrap().adopt(claim, key, store, true) {
        return Err(Error::Locked);
    }
    Ok(UnlockResult {
        entries,
        sync_configured: true,
    })
}

/// Give a workspace a (new) label. Ids never change; only this does.
#[tauri::command]
pub fn workspace_rename(
    id: String,
    name: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(Error::WorkspaceNameRequired);
    }

    let root = storage::root_dir(&app)?;
    update_registry(&state, &root, |registry| {
        let workspace = registry
            .workspaces
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or(Error::NotFound)?;
        workspace.name = Some(name);
        Ok(())
    })
}

// Argon2id + creating the encrypted DB, off the command thread. The directory
// comes first: `create_vault` writes the KDF sidecar before SQLCipher opens
// anything, and the sidecar must land in the new workspace, not beside it.
//
// With an account to inherit, the vault is also named and connected here, so a
// failure in either leaves the caller one `discard` from a clean slate. The id
// is returned for the registry; `None` is a local vault, which has none.
async fn create_vault_in(
    app: &AppHandle,
    root: &Path,
    id: &str,
    password: Zeroizing<String>,
    inherited: Option<&sync::Tokens>,
) -> Result<(VaultKey, SqliteStore, Option<String>)> {
    let dir = workspace::dir_of(root, id);
    crate::store::create_private_dir(&dir)?;
    let (key, store) = create_off_thread(app, password).await?;
    let Some(tokens) = inherited else {
        return Ok((key, store, None));
    };
    // The id before the tokens, as every other stamp-and-seal here orders them:
    // nothing is sealed under a key a failure would then discard.
    let vault_id = crate::crypto::random_hex_id();
    crate::store::identity::adopt_vault_id(&store, &vault_id).map_err(store_err)?;
    sync::persist_tokens(app, &key.cryptor(), tokens)?;
    Ok((key, store, Some(vault_id)))
}

// Everything that turns the chosen pack into a workspace on this device, off
// the command thread: Argon2id, a SQLCipher open and three file writes are all
// blocking work.
//
// `restore_at` is handed the new workspace's paths outright, since its core runs
// without an `AppHandle`. The token file is not: `persist_tokens` resolves
// through whichever workspace is active, which is why the paths are repointed
// before this runs — that is what puts the account inside the new workspace
// rather than beside the old one's.
async fn restore_vault_in(
    app: &AppHandle,
    root: &Path,
    id: &str,
    bytes: Vec<u8>,
    password: Zeroizing<String>,
    vault_id: &str,
    tokens: &sync::Tokens,
) -> Result<(VaultKey, SqliteStore, Vec<EntryMetaDto>)> {
    let dir = workspace::dir_of(root, id);
    crate::store::create_private_dir(&dir)?;

    let app = app.clone();
    let vault_id = vault_id.to_string();
    let tokens = tokens.clone();
    super::blocking(move || {
        let (key, store) = restore::restore_at(
            &dir.join(storage::DB_FILE),
            &dir.join(storage::KDF_SIDECAR_FILE),
            &bytes,
            &password,
        )?;
        // The file name is how the account addresses this vault, and it is
        // authoritative over whatever the snapshot carries — the same stamp
        // onboarding applies, for the same reason (`commands::setup::adopt`).
        crate::store::identity::adopt_vault_id(&store, &vault_id).map_err(store_err)?;
        // The listing before the tokens, as `adopt` orders them: nothing is
        // sealed under a key that a failure would then discard.
        let entries = list_metas(&store)?;
        sync::persist_tokens(&app, &key.cryptor(), &tokens)?;
        Ok((key, store, entries))
    })
    .await
}

/// Refuse a pack this device would end up holding twice.
///
/// Restoring a vault beside itself would leave two workspaces syncing one pack,
/// each merging over the other — a duplicate the user has no way to tell apart
/// afterwards, since the two would look identical.
///
/// Two places know which vault a workspace holds. The open one is asked live,
/// from the id in its own database. Every other workspace is locked and its
/// database unreadable, so those are asked through the registry, which records
/// each workspace's vault id as its syncs settle it (`Workspace::vault_id`).
/// A workspace that never synced has no record there — and no pack on Drive to
/// be restored from, so nothing is missed by that.
fn guard_other_vault(state: &AppState, root: &Path, vault_id: &str) -> Result<()> {
    let session = state.session.lock().unwrap();
    // Locked, or held out by another whole-vault operation: nothing to compare
    // against live, and the lease below is what will turn that away.
    if let Ok(store) = session.store() {
        if crate::store::identity::vault_id(store)
            .map_err(store_err)?
            .as_deref()
            == Some(vault_id)
        {
            return Err(Error::VaultAlreadyOpen);
        }
    }
    drop(session);

    let active = state.active_workspace.lock().unwrap().clone();
    if Registry::load(root).holder_of(vault_id, &active).is_some() {
        return Err(Error::VaultAlreadyOpen);
    }
    Ok(())
}

// Undo everything `create_vault_in` or `restore_vault_in` may have written.
// Removing the directory is what takes the restored workspace's token file with
// it — the one file of the set that is not named here.
fn discard(root: &Path, id: &str) {
    let dir = workspace::dir_of(root, id);
    storage::remove_db_files(&dir.join(storage::DB_FILE));
    let _ = fs::remove_file(dir.join(storage::KDF_SIDECAR_FILE));
    let _ = fs::remove_dir_all(&dir);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::identity;
    use crate::workspace::PRIMARY_ID;

    fn store() -> SqliteStore {
        static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "rowel-workspace-restore-{}-{}.db",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        SqliteStore::open(&path, &[9u8; 32]).unwrap()
    }

    // A key of the right shape; nothing here derives or opens anything with it.
    fn key() -> VaultKey {
        VaultKey::Argon2 {
            master: Zeroizing::new(vec![0u8; 32]),
        }
    }

    fn open_with(store: SqliteStore) -> AppState {
        let state = AppState::default();
        state.session.lock().unwrap().set(key(), store, false);
        state
    }

    // A data dir with no registry file: one primary, nothing recorded.
    fn tmp_root() -> std::path::PathBuf {
        static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "rowel-workspace-guard-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // The collision seen live: the vault the user is looking at as they pick
    // which pack to restore.
    #[test]
    fn the_open_workspaces_own_vault_is_refused() {
        let store = store();
        identity::adopt_vault_id(&store, "a1b2").unwrap();

        assert!(matches!(
            guard_other_vault(&open_with(store), &tmp_root(), "a1b2"),
            Err(Error::VaultAlreadyOpen)
        ));
    }

    // Every other pack on the account is exactly what this flow is for.
    #[test]
    fn another_vault_on_the_same_account_is_allowed() {
        let store = store();
        identity::adopt_vault_id(&store, "a1b2").unwrap();

        assert!(guard_other_vault(&open_with(store), &tmp_root(), "cafe").is_ok());
    }

    // A vault created before ids existed answers to no pack, so it cannot be
    // the one being restored.
    #[test]
    fn a_vault_with_no_id_collides_with_nothing() {
        assert!(guard_other_vault(&open_with(store()), &tmp_root(), "a1b2").is_ok());
    }

    // The collision seen through the registry: a workspace that is locked, and
    // whose vault id a sync recorded — the one the live check cannot reach.
    #[test]
    fn a_locked_workspaces_recorded_vault_is_refused() {
        let root = tmp_root();
        Registry {
            active: PRIMARY_ID.into(),
            workspaces: vec![
                Workspace {
                    id: PRIMARY_ID.into(),
                    name: None,
                    vault_id: None,
                },
                Workspace {
                    id: "b2c3".into(),
                    name: Some("Work".into()),
                    vault_id: Some("cafe".into()),
                },
            ],
        }
        .save(&root)
        .unwrap();

        // Asked from the open primary, which holds another vault entirely.
        let store = store();
        identity::adopt_vault_id(&store, "a1b2").unwrap();
        let state = open_with(store);
        assert!(matches!(
            guard_other_vault(&state, &root, "cafe"),
            Err(Error::VaultAlreadyOpen)
        ));
        // A pack nobody here holds is still fine.
        assert!(guard_other_vault(&state, &root, "beef").is_ok());
    }

    // A locked session has nothing to compare against live, and the registry
    // records nothing for this pack. The lease the restore takes next is what
    // turns the locked session away, and it says `Locked` when it does.
    #[test]
    fn a_locked_workspace_is_left_to_the_lease_to_refuse() {
        assert!(guard_other_vault(&AppState::default(), &tmp_root(), "a1b2").is_ok());
    }
}
