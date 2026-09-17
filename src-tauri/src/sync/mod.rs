//! Google Drive sync provider. Finds (or creates) `Rowel/Vaults/` and the
//! `<vault-id>.rowel` pack inside it, and reads/writes that one file. Every
//! name it uses comes from [`layout`].
//!
//! Which pack is *this* vault's is settled once per run, before the engine
//! starts: see [`resolve_vault_id`]. That step is also where an install still
//! keeping its pack at the pre-`Vaults/` `Rowel/vault.swsync` has it moved into
//! place, so the rest of this module only ever knows the one layout.
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
use engine::{LocalVault, Remote, RemoteFile, SessionVault, SyncOutcome};

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

/// Why a run was started, as far as choosing the pack goes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Intent {
    /// The ordinary run: this vault's own pack, whatever else the account holds.
    Sync,
    /// "Import from Drive": the user wants what the account already has
    /// brought into this vault. If the account holds exactly one vault, this
    /// vault takes on its id and merges with it — its own, usually empty, pack
    /// would otherwise be the only thing an import ever found.
    Import,
}

/// One full sync against Drive. Blocking: call it on a dedicated thread.
pub fn run(app: &AppHandle, cryptor: Cryptor, intent: Intent) -> Result<SyncOutcome> {
    if !is_configured(app, &cryptor) {
        return Err(Error::SyncNotConfigured);
    }
    let local = SessionVault::capture(app)?;
    // Which pack on Drive is this vault's, decided before a byte is pulled. A
    // failure here is a sync failure like any other: addressing the wrong pack
    // — or a second one — is the one mistake the merge cannot undo.
    let vault_id = block_on(resolve_vault_id(app, &cryptor, &local, intent))?;
    let remote = DriveRemote::new(app.clone(), cryptor, vault_id);
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

// --- which pack is ours -----------------------------------------------------

/// What the vault-id resolution has to do before a run can address a pack.
///
/// Split out from the Drive calls so the decision — the part with every
/// upgrade and first-run case in it — is a pure function over three facts and
/// can be read, and tested, on its own.
#[derive(Debug, Clone, PartialEq, Eq)]
enum VaultIdPlan {
    /// Address `<id>.rowel`. Either it is already there, or the first push
    /// creates it.
    Use(String),
    /// Mint an id locally. Nothing on the remote has anything to say about it.
    Assign,
    /// Take on the id of the one live pack the account holds. The pull that
    /// follows is what brings its data in.
    Adopt(String),
    /// Address `<id>.rowel`, with the legacy pack still to be moved into
    /// `Vaults/` under that name first.
    MigrateLegacy(String),
    /// A legacy pack and no local id: mint one, and move the pack in under it.
    AssignAndMigrateLegacy,
    /// Several live packs and nothing local to say which of them is this
    /// vault's. Guessing would merge two people's vaults into one.
    Ambiguous,
}

/// Decide which vault id this run addresses.
///
/// `local` is the id in this vault's `meta` table, `legacy` whether
/// `Rowel/vault.swsync` is still there, and `live` the ids of the packs found
/// in `Vaults/` (an absent folder is simply none of them).
fn plan_vault_id(intent: Intent, local: Option<&str>, legacy: bool, live: &[&str]) -> VaultIdPlan {
    // An import is the one time the account's pack outranks this vault's own
    // name: the user asked for what is up there. With nothing up there it is an
    // ordinary run, and with several packs there is no telling which they meant.
    if intent == Intent::Import {
        match live {
            [] => {}
            [only] if Some(*only) == local => return VaultIdPlan::Use((*only).to_string()),
            [only] => return VaultIdPlan::Adopt((*only).to_string()),
            _ => return VaultIdPlan::Ambiguous,
        }
    }
    match (local, legacy) {
        // A local id settles it outright; the legacy pack is only interesting
        // while `Vaults/` does not already hold this vault's pack.
        (Some(id), true) if !live.contains(&id) => VaultIdPlan::MigrateLegacy(id.to_string()),
        (Some(id), _) => VaultIdPlan::Use(id.to_string()),
        (None, true) => VaultIdPlan::AssignAndMigrateLegacy,
        (None, false) => match live {
            [] => VaultIdPlan::Assign,
            [only] => VaultIdPlan::Adopt((*only).to_string()),
            _ => VaultIdPlan::Ambiguous,
        },
    }
}

// Surfaced verbatim by the sync indicator, so it has to read as a sentence.
fn ambiguous_vault_error() -> String {
    format!(
        "this Google account holds more than one {} vault and nothing says which of them is \
         meant; restore the one you want onto a fresh install instead",
        crate::app::APP_NAME
    )
}

/// Settle the vault id for this run, doing whatever Drive work [`plan_vault_id`]
/// calls for.
///
/// The one place the two layouts meet: afterwards the account holds this
/// vault's pack under `Vaults/<id>.rowel` (or holds nothing yet, and the first
/// push puts it there), and the local vault knows that id.
async fn resolve_vault_id(
    app: &AppHandle,
    cryptor: &Cryptor,
    local: &impl LocalVault,
    intent: Intent,
) -> Result<String> {
    let client = http_client();
    let token = auth::access_token(&client, app, cryptor).await?;

    let root = drive::folder_id(&client, &token, layout::ROOT_FOLDER).await?;
    let mut legacy = None;
    let mut live: Vec<String> = Vec::new();
    if let Some(root) = &root {
        legacy = drive::find_file(&client, &token, layout::LEGACY_VAULT_FILE, root).await?;
        // A missing `Vaults/` is an account no build that knew about the folder
        // has ever written to, which is the same answer as an empty one.
        let vaults = drive::folder_id_in(&client, &token, layout::VAULTS_FOLDER, root).await?;
        if let Some(vaults) = vaults {
            live = drive::list_folder(&client, &token, &vaults)
                .await?
                .iter()
                .filter_map(|file| layout::vault_id_of(&file.name).map(str::to_string))
                .collect();
        }
    }
    let live: Vec<&str> = live.iter().map(String::as_str).collect();

    let plan = plan_vault_id(
        intent,
        local.vault_id()?.as_deref(),
        legacy.is_some(),
        &live,
    );
    let (id, migrate) = match plan {
        VaultIdPlan::Use(id) => (id, false),
        VaultIdPlan::Assign => (local.assign_vault_id()?, false),
        VaultIdPlan::Adopt(id) => {
            local.adopt_vault_id(&id)?;
            (id, false)
        }
        VaultIdPlan::MigrateLegacy(id) => (id, true),
        VaultIdPlan::AssignAndMigrateLegacy => (local.assign_vault_id()?, true),
        VaultIdPlan::Ambiguous => return Err(Error::Other(ambiguous_vault_error())),
    };

    // Moved, not re-uploaded: the file keeps its Drive id and its whole
    // revision history, so a user who wants yesterday's vault back still has it
    // — and the account is never left holding two packs, one of which quietly
    // stops being written to.
    if let (true, Some(root), Some(legacy)) = (migrate, root.as_deref(), &legacy) {
        let vaults = ensure_vaults_folder(&client, &token, root).await?;
        let name = layout::vault_file_name(&id);
        drive::move_file(&client, &token, &legacy.id, &name, root, &vaults).await?;
    }

    Ok(id)
}

/// `Rowel/Vaults`, created if this account has never had one.
async fn ensure_vaults_folder(client: &Client, token: &str, root: &str) -> Result<String> {
    match drive::folder_id_in(client, token, layout::VAULTS_FOLDER, root).await? {
        Some(id) => Ok(id),
        None => drive::create_folder_in(client, token, layout::VAULTS_FOLDER, Some(root)).await,
    }
}

/// [`Remote`] over one vault's pack, `Rowel/Vaults/<vault-id>.rowel`.
///
/// Both folder ids are resolved once per instance (one instance per run)
/// because the selection rule is deterministic and re-listing them would only
/// cost round trips. The *file* is re-listed on every call: `head_revision`
/// exists precisely to observe a change another device made, so it must never
/// answer from a cache.
struct DriveRemote {
    app: AppHandle,
    cryptor: Cryptor,
    /// Settled by [`resolve_vault_id`] before the run starts, so every call
    /// below knows the file name it is after without asking again.
    vault_id: String,
    root: Mutex<Option<String>>,
    vaults: Mutex<Option<String>>,
}

impl DriveRemote {
    fn new(app: AppHandle, cryptor: Cryptor, vault_id: String) -> Self {
        Self {
            app,
            cryptor,
            vault_id,
            root: Mutex::new(None),
            vaults: Mutex::new(None),
        }
    }

    // Resolve the Rowel folder, remembering it for the rest of the run.
    // `None` means it does not exist yet — which is also "no remote vault".
    async fn root(&self, client: &Client, token: &str) -> Result<Option<String>> {
        if let Some(id) = self.root.lock().unwrap().clone() {
            return Ok(Some(id));
        }
        let found = drive::folder_id(client, token, layout::ROOT_FOLDER).await?;
        if let Some(id) = &found {
            *self.root.lock().unwrap() = Some(id.clone());
        }
        Ok(found)
    }

    // `Rowel/Vaults`, the same way.
    async fn vaults(&self, client: &Client, token: &str) -> Result<Option<String>> {
        if let Some(id) = self.vaults.lock().unwrap().clone() {
            return Ok(Some(id));
        }
        let Some(root) = self.root(client, token).await? else {
            return Ok(None);
        };
        let found = drive::folder_id_in(client, token, layout::VAULTS_FOLDER, &root).await?;
        if let Some(id) = &found {
            *self.vaults.lock().unwrap() = Some(id.clone());
        }
        Ok(found)
    }

    // [`vaults`], for the push: both folders are created when this is the first
    // thing this account has ever had put in it.
    async fn ensure_vaults(&self, client: &Client, token: &str) -> Result<String> {
        if let Some(id) = self.vaults(client, token).await? {
            return Ok(id);
        }
        let root = match self.root(client, token).await? {
            Some(id) => id,
            None => {
                let id = drive::create_folder(client, token, layout::ROOT_FOLDER).await?;
                *self.root.lock().unwrap() = Some(id.clone());
                id
            }
        };
        let id = ensure_vaults_folder(client, token, &root).await?;
        *self.vaults.lock().unwrap() = Some(id.clone());
        Ok(id)
    }

    async fn locate(&self, client: &Client, token: &str) -> Result<Option<drive::DriveFile>> {
        let Some(vaults) = self.vaults(client, token).await? else {
            return Ok(None);
        };
        let name = layout::vault_file_name(&self.vault_id);
        drive::find_file(client, token, &name, &vaults).await
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
            let vaults = self.ensure_vaults(&client, &token).await?;
            let name = layout::vault_file_name(&self.vault_id);
            let revision = match drive::find_file(&client, &token, &name, &vaults).await? {
                Some(file) => drive::update_file(&client, &token, &file.id, bytes).await?,
                None => {
                    drive::create_file(&client, &token, &name, &vaults, bytes)
                        .await?
                        .head_revision
                }
            };
            Ok(revision.unwrap_or_default())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{plan_vault_id, Intent, VaultIdPlan};

    const ID: &str = "a1b2c3";

    fn plan(local: Option<&str>, legacy: bool, live: &[&str]) -> VaultIdPlan {
        plan_vault_id(Intent::Sync, local, legacy, live)
    }

    fn import(local: Option<&str>, legacy: bool, live: &[&str]) -> VaultIdPlan {
        plan_vault_id(Intent::Import, local, legacy, live)
    }

    #[test]
    fn a_vault_that_knows_its_id_simply_uses_it() {
        // Its pack is there; and if it is not, the first push creates it.
        assert_eq!(plan(Some(ID), false, &[ID]), VaultIdPlan::Use(ID.into()));
        assert_eq!(plan(Some(ID), false, &[]), VaultIdPlan::Use(ID.into()));
        // Another vault's pack in the folder is none of this one's business.
        assert_eq!(
            plan(Some(ID), false, &["dddd", "eeee"]),
            VaultIdPlan::Use(ID.into())
        );
    }

    #[test]
    fn an_upgraded_install_moves_its_legacy_pack_under_its_own_id() {
        assert_eq!(
            plan(Some(ID), true, &[]),
            VaultIdPlan::MigrateLegacy(ID.into())
        );
    }

    // "Import from Drive" is asked by a vault that has an id of its own and,
    // usually, nothing in it. Keeping that id would find nothing to import.
    #[test]
    fn an_import_takes_on_the_one_vault_the_account_holds() {
        assert_eq!(
            import(Some(ID), false, &["dddd"]),
            VaultIdPlan::Adopt("dddd".into())
        );
        assert_eq!(
            import(None, false, &["dddd"]),
            VaultIdPlan::Adopt("dddd".into())
        );
        // Already that vault: nothing to take on.
        assert_eq!(import(Some(ID), false, &[ID]), VaultIdPlan::Use(ID.into()));
    }

    #[test]
    fn an_import_refuses_to_guess_between_several_vaults() {
        assert_eq!(
            import(Some(ID), false, &["dddd", "eeee"]),
            VaultIdPlan::Ambiguous
        );
    }

    // With nothing under `Vaults/` an import is an ordinary run: the legacy
    // pack, if any, is moved in and merged the same way.
    #[test]
    fn an_import_into_an_empty_account_behaves_like_a_sync() {
        assert_eq!(import(Some(ID), false, &[]), VaultIdPlan::Use(ID.into()));
        assert_eq!(
            import(Some(ID), true, &[]),
            VaultIdPlan::MigrateLegacy(ID.into())
        );
        assert_eq!(import(None, true, &[]), VaultIdPlan::AssignAndMigrateLegacy);
    }

    // The migration already ran — on this device or another — and left the
    // legacy file behind (a stale listing, a peer mid-migration). Moving it a
    // second time would overwrite nothing, but it would put an old snapshot
    // back on top of the live pack's name.
    #[test]
    fn a_legacy_file_beside_an_already_migrated_pack_is_left_alone() {
        assert_eq!(plan(Some(ID), true, &[ID]), VaultIdPlan::Use(ID.into()));
    }

    #[test]
    fn a_vault_from_before_ids_takes_the_legacy_pack_with_it() {
        assert_eq!(plan(None, true, &[]), VaultIdPlan::AssignAndMigrateLegacy);
    }

    #[test]
    fn an_idless_vault_adopts_the_one_pack_the_account_holds() {
        assert_eq!(
            plan(None, false, &["dddd"]),
            VaultIdPlan::Adopt("dddd".into())
        );
    }

    #[test]
    fn an_idless_vault_with_nothing_to_adopt_mints_an_id() {
        assert_eq!(plan(None, false, &[]), VaultIdPlan::Assign);
    }

    // Picking one would push this vault's entries into a stranger's pack and
    // pull theirs back. There is no evidence here to pick on, so it stops.
    #[test]
    fn an_idless_vault_facing_several_packs_refuses_to_guess() {
        assert_eq!(plan(None, false, &["dddd", "eeee"]), VaultIdPlan::Ambiguous);
    }
}
