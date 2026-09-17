//! Bringing the account's other vaults onto this device without asking — when
//! the password that just opened a vault opens them too.
//!
//! Every device connected to an account is meant to hold every vault in it.
//! Settings › Workspaces offers the missing ones after each sync
//! (`sync::publish_remote_vaults`), but each has to be restored by hand with
//! its master password. Most people give their vaults one password, and for
//! them that prompt is a chore with one possible answer. So the moment a
//! password is in hand — a password unlock, a restore — it is tried against
//! the account's packs this device lacks, and the ones it opens become
//! workspaces here, beside the open one and without switching to it. A pack it
//! does not open is left where it was, for the Workspaces section to offer.
//!
//! The password outlives the command that had it by exactly the length of this
//! task: it is moved into a blocking-pool thread as a `Zeroizing<String>`,
//! spent on each candidate's Argon2id derive, and scrubbed when the thread
//! ends. It is never written anywhere. The task stops starting candidates once
//! [`JOIN_BUDGET`] has passed, so that length is the budget plus the one
//! download in flight when it ran out; whatever was not tried stays on offer.
//! Biometric unlock has a key and no password, so it cannot do this. See
//! docs/threat-model.md.

use std::collections::HashSet;
use std::path::Path;
use std::time::{Duration, Instant};

use tauri::{async_runtime::block_on, AppHandle, Manager};
use zeroize::Zeroizing;

/// How long the task keeps starting on new candidates. A bound on how long the
/// password stays in memory, not on the work: a slow link or an account with
/// many vaults leaves the rest for Settings › Workspaces and the next unlock.
const JOIN_BUDGET: Duration = Duration::from_secs(60);

use crate::error::{Error, Result};
use crate::session::store_err;
use crate::state::AppState;
use crate::storage;
use crate::sync::{self, restore, setup::PackInfo, Tokens};
use crate::workspace::{self, Registry, Workspace};

use super::setup::{self as onboarding, begin_step};
use super::workspace::{discard, guard_other_vault, update_registry};

/// Try `password` against the vaults the open workspace's account holds and
/// this device does not. Returns at once; the work runs on the blocking pool
/// and reports through `workspaces:added` (one per vault) and a refreshed
/// `workspaces:remote`. A workspace that does not sync has nothing to try.
pub(crate) fn with_password(app: &AppHandle, password: Zeroizing<String>) {
    let app = app.clone();
    // A blocking-pool thread, not a runtime worker: the Drive calls are driven
    // with `block_on`, and Argon2id runs once per candidate.
    super::detached(move || {
        if let Err(e) = join_all(&app, &password) {
            log::warn!("joining the account's other vaults was skipped: {e}");
        }
    });
}

fn join_all(app: &AppHandle, password: &str) -> Result<()> {
    let state = app.state::<AppState>();
    let root = storage::root_dir(app)?;

    // The open workspace, its account and its vault id, as one step under the
    // workspace lock: the token file resolves through the active paths, which
    // must be the same paths the session's key belongs to. The connection
    // generation is read here too, so a disconnect landing anywhere in the
    // task can be told (see [`Account::settle`]).
    let (account, own_vault_id, mut tokens) = {
        let _paths = state.workspace_lock.lock().unwrap();
        let workspace = state.active_workspace.lock().unwrap().clone();
        let session = state.session.lock().unwrap();
        let cryptor = session.cryptor()?;
        let own = crate::store::identity::vault_id(session.store()?).map_err(store_err)?;
        let Some(tokens) = sync::current_tokens(app, &cryptor) else {
            return Ok(());
        };
        let account = Account {
            workspace,
            generation: sync::connection_generation(app),
        };
        (account, own, tokens)
    };
    let started = Instant::now();

    // No lock held from here on: everything below is network or the new
    // workspace's own files, and the registry writes take their own lock.
    let packs = block_on(onboarding::probe(app, &mut tokens))?;
    let held = held_vault_ids(&Registry::load(&root), own_vault_id.as_deref());
    let candidates = sync::remote_only(packs, &held);
    if candidates.is_empty() {
        return Ok(());
    }

    let mut remaining = Vec::new();
    let mut candidates = candidates.into_iter();
    for pack in candidates.by_ref() {
        if started.elapsed() >= JOIN_BUDGET {
            remaining.push(pack);
            break;
        }
        match join_one(app, &state, &root, &account, &mut tokens, &pack, password) {
            Ok(name) => crate::events::workspace_added(app, &name),
            // Sealed with a different password: theirs to restore by hand, so
            // it stays on offer.
            Err(Error::InvalidPassword) => remaining.push(pack),
            // The account was disconnected under the task. Nothing more may be
            // sealed anywhere with credentials the user just dropped.
            Err(Error::SyncNotConfigured) => {
                log::info!("the account was disconnected while its vaults were being added");
                remaining.push(pack);
                break;
            }
            Err(e) => {
                log::warn!("could not add the account's vault {}: {e}", pack.vault_id);
                remaining.push(pack);
            }
        }
    }
    remaining.extend(candidates);
    // The Workspaces section shows what is left, without waiting for the next
    // sync run to say the same.
    crate::events::remote_vaults(app, remaining);
    Ok(())
}

/// The account the task runs on: which workspace's token file it came from, and
/// which connection it was read under.
struct Account {
    workspace: String,
    generation: u64,
}

impl Account {
    /// Write `tokens` — refreshed by the round trips so far — back to the
    /// workspace they came from, so that it does not keep a refresh token
    /// Google may have retired while only the new workspaces hold the live one.
    ///
    /// Under the workspace lock, and only if that workspace is still the active
    /// one (the file resolves through the active paths) and the connection is
    /// still the one the task began under. `Ok(false)` is a disconnect: the
    /// caller stops. A switch to another workspace, or a session that locked
    /// meanwhile, is not — the copy in memory stays good for the installs, and
    /// the workspace refreshes for itself on its next run.
    fn settle(&self, app: &AppHandle, state: &AppState, tokens: &Tokens) -> Result<bool> {
        let _paths = state.workspace_lock.lock().unwrap();
        if sync::connection_generation(app) != self.generation {
            return Ok(false);
        }
        if *state.active_workspace.lock().unwrap() != self.workspace {
            return Ok(true);
        }
        let Ok(cryptor) = state.session.lock().unwrap().cryptor() else {
            return Ok(true);
        };
        sync::persist_tokens_if_current(app, &cryptor, tokens, self.generation)
    }
}

/// Every vault a workspace on this device holds, plus the open one's — whose
/// registry record may still be a sync away.
fn held_vault_ids(registry: &Registry, own: Option<&str>) -> HashSet<String> {
    registry
        .workspaces
        .iter()
        .filter_map(|w| w.vault_id.clone())
        .chain(own.map(str::to_string))
        .collect()
}

/// Download `pack` and, if `password` opens it, make it a workspace. The name
/// it was given comes back; a pack the password does not open is
/// [`Error::InvalidPassword`], and leaves nothing behind. A disconnect that
/// landed under the task is [`Error::SyncNotConfigured`].
fn join_one(
    app: &AppHandle,
    state: &AppState,
    root: &Path,
    account: &Account,
    tokens: &mut Tokens,
    pack: &PackInfo,
    password: &str,
) -> Result<String> {
    // The network half first, with nothing held. The pack is refused before
    // the download if a workspace here already holds it — a listing that
    // predates a restore the user made meanwhile.
    let (bytes, vault_id) = block_on(onboarding::download(app, tokens, &pack.id, |vault_id| {
        guard_other_vault(state, root, vault_id)
    }))?;
    // The round trips may have refreshed the tokens; the workspace they came
    // from gets the refreshed copy before anything else does — and if the
    // account was disconnected meanwhile, nothing does.
    if !account.settle(app, state, tokens)? {
        return Err(Error::SyncNotConfigured);
    }

    // Writing a workspace takes the exclusion a create or a restore takes. Busy
    // means one of those is running right now; this vault is left for the
    // Workspaces section, and for the next unlock. A restore that finished
    // during the download may have been of this very pack, so the refusal is
    // asked again with the step held — cheaply, before the Argon2id work — and
    // once more inside the registry write, where it cannot be raced.
    let _step = begin_step(state)?;
    guard_other_vault(state, root, &vault_id)?;
    let id = crate::crypto::random_hex_id();
    let dir = workspace::dir_of(root, &id);
    let name = match install(&dir, &bytes, password, &vault_id, tokens) {
        Ok(name) => name,
        Err(e) => {
            // Nothing half-made: the directory goes, token file and all.
            discard(root, &id);
            return Err(e);
        }
    };

    // Registry last, as every workspace writer records it: an entry only once
    // there is a vault behind it. Not `active` — the user is looking at the
    // vault they unlocked, and stays there. The check and the write are one
    // step under the registry's lock, so no second holder of this vault can
    // be recorded beside it.
    let recorded = update_registry(state, root, |registry| {
        guard_other_vault(state, root, &vault_id)?;
        registry.workspaces.push(Workspace {
            id: id.clone(),
            name: Some(name.clone()),
            vault_id: Some(vault_id.clone()),
        });
        Ok(())
    });
    if let Err(e) = recorded {
        discard(root, &id);
        return Err(e);
    }
    Ok(name)
}

/// The restored vault's files, in `dir`, connected: the pack installed under
/// `password`, the vault stamped with the id its file name gave it (as every
/// restore stamps it), and the account sealed under the new key — into `dir`
/// outright, since the active paths belong to the open workspace and stay put.
fn install(
    dir: &Path,
    bytes: &[u8],
    password: &str,
    vault_id: &str,
    tokens: &Tokens,
) -> Result<String> {
    crate::store::create_private_dir(dir)?;
    let (key, store) = restore::restore_at(
        &dir.join(storage::DB_FILE),
        &dir.join(storage::KDF_SIDECAR_FILE),
        bytes,
        password,
    )?;
    crate::store::identity::adopt_vault_id(&store, vault_id).map_err(store_err)?;
    sync::persist_tokens_in(dir, &key.cryptor(), tokens)?;
    // Closed before the registry names it: the next unlock of it opens fresh.
    drop(store);
    Ok(label(vault_id))
}

/// What the added workspace is called until the user renames it. The vault's
/// own id, shortened: the one thing that tells two of them apart, and the same
/// thing Drive shows in the file name.
fn label(vault_id: &str) -> String {
    let short: String = vault_id.chars().take(6).collect();
    format!("Vault {short}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::PRIMARY_ID;

    #[test]
    fn the_label_is_the_vault_id_shortened() {
        assert_eq!(label("9f3c1a2b4d5e6f70"), "Vault 9f3c1a");
        assert_eq!(label("ab"), "Vault ab");
    }

    // The open vault counts as held even before a sync has recorded it: a pack
    // of its own would otherwise be offered back to it.
    #[test]
    fn held_vaults_are_the_registrys_and_the_open_ones() {
        let registry = Registry {
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
        };
        let held = held_vault_ids(&registry, Some("a1b2"));
        assert!(held.contains("cafe"));
        assert!(held.contains("a1b2"));
        assert_eq!(held.len(), 2);
        assert_eq!(held_vault_ids(&registry, None).len(), 1);
    }
}
