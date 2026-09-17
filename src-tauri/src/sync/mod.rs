//! Google Drive sync provider. Finds (or creates) `Rowel/Vaults/` and the
//! `<vault-id>.rowel` pack inside it, and reads/writes that one file. Every
//! name it uses comes from [`layout`].
//!
//! Which pack is *this* vault's is settled once per run, before the engine
//! starts: see [`resolve_vault_id`].
//!
//! The id that step settles on reaches the vault's `meta` table in the middle of
//! the run it was settled for (see [`run`]), never at either end: after the
//! remote pack has been fetched, decoded and merged — until then nothing has
//! proved it is this vault's — and before anything is packed or uploaded, so
//! Drive is never changed under an id this vault does not yet answer to.
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

/// Drop the account locally. An error means the token file is still on disk
/// and the account is therefore still connected.
pub fn disconnect(app: &AppHandle) -> Result<()> {
    auth::disconnect(app)
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
    let resolved = block_on(resolve_vault_id(app, &cryptor, &local, intent))?;
    let remote = DriveRemote::new(app.clone(), cryptor, resolved.id.clone());

    // The id is written from inside the run, at the one moment that satisfies
    // both of the things this ordering has to guarantee (see [`engine::sync`],
    // which decides when that moment is):
    //
    // * Nothing before the pull has been fetched, decoded and merged. An import
    //   that cannot reach or read the pack it was pointed at leaves this vault
    //   answering to the id it already had, rather than to a pack it has never
    //   seen a record of.
    // * Nothing after the first push. Written afterwards, a vault that locked
    //   between the upload and the write would have changed Drive without
    //   changing itself: an id-less vault would have published `<new-id>.rowel`
    //   and would mint a *different* id on its next run, and an import would
    //   have updated the adopted pack while still answering to its old name.
    //
    // A `settle` that fails therefore aborts the run before anything is
    // uploaded, and the account is left as the run found it.
    //
    // Because the write lands before `pack()`, the first pack an assigned or
    // adopted vault pushes already names its own id inside `meta`. The file name
    // names it too, which is what addresses it on Drive, and a restore still
    // takes the id from there (`restore::adopt_vault_id_from_name`) — belt and
    // braces for packs written before this ordering existed.
    let outcome = engine::sync(&remote, &local, now_ms(), || {
        if resolved.persist {
            // `adopt_vault_id` covers a minted id as well as one taken from the
            // remote: by the time the write happens they are both simply "the
            // id this run proved to be ours".
            local.adopt_vault_id(&resolved.id)?;
        }
        Ok(())
    })?;

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
/// first-run and import case in it — is a pure function over two facts and can
/// be read, and tested, on its own.
#[derive(Debug, Clone, PartialEq, Eq)]
enum VaultIdPlan {
    /// Address `<id>.rowel`. Either it is already there, or the first push
    /// creates it.
    Use(String),
    /// Mint an id. Nothing on the remote has anything to say about it.
    Assign,
    /// Take on an id the remote says is this vault's. The pull that follows is
    /// what brings its data in.
    Adopt(String),
    /// An import facing several live packs, with nothing to say which of them
    /// the user meant. Guessing would merge two vaults into one.
    Ambiguous,
}

/// Decide which vault id this run addresses.
///
/// `local` is the id in this vault's `meta` table and `live` the ids of the
/// packs found in `Vaults/` (an absent folder is simply none of them).
///
/// The rule underneath the arms: a remote pack is only ever taken on when the
/// user *asks* for it, by importing. A pack that merely happens to be the only
/// one in the account is not evidence of anything.
fn plan_vault_id(intent: Intent, local: Option<&str>, live: &[&str]) -> VaultIdPlan {
    // An import is the one time the account's pack outranks this vault's own
    // name: the user asked for what is up there. With nothing up there it is an
    // ordinary run, and with several packs there is no telling which they meant.
    if intent == Intent::Import {
        match live {
            [] => {}
            // Already syncing to that pack, so there is nothing to take on and
            // no reason to re-point a vault that is where it belongs.
            [only] if Some(*only) == local => return VaultIdPlan::Use((*only).to_string()),
            [only] => return VaultIdPlan::Adopt((*only).to_string()),
            _ => return VaultIdPlan::Ambiguous,
        }
    }
    match local {
        // Its own name is the answer, whatever else the account holds.
        Some(id) => VaultIdPlan::Use(id.to_string()),
        // A vault that has never synced. Whatever packs are up there belong to
        // other installs until the user says otherwise.
        None => VaultIdPlan::Assign,
    }
}

// Surfaced verbatim by the sync indicator, so it has to read as a sentence.
// Only an import can reach it: an ordinary run never chooses between packs.
fn ambiguous_vault_error() -> String {
    format!(
        "this Google account holds more than one {} vault and nothing says which of them to \
         import; restore the one you want onto a fresh install instead",
        crate::app::APP_NAME
    )
}

/// The vault id a run addresses, and whether the local vault has yet to be told
/// about it.
struct Resolved {
    /// The id every file name in this run is built from.
    id: String,
    /// Whether `meta` still has to be given `id` — an assign or an adopt, as
    /// opposed to a vault that already knew its own name. Deliberately *not*
    /// written by [`resolve_vault_id`]: see [`run`], which hands the write to
    /// the engine to make mid-run, once the pull has proved the id and before
    /// any push can act on it.
    persist: bool,
}

/// Settle the vault id for this run, doing whatever Drive work [`plan_vault_id`]
/// calls for.
///
/// The *local* vault is not touched here at all — an id this function minted
/// lives in memory until the run's own pull has proved it (see [`run`]), which
/// is what keeps a failed run from leaving a vault pointed at a pack it never
/// read.
async fn resolve_vault_id(
    app: &AppHandle,
    cryptor: &Cryptor,
    local: &impl LocalVault,
    intent: Intent,
) -> Result<Resolved> {
    let client = http_client();
    let token = auth::access_token(&client, app, cryptor).await?;

    let mut live: Vec<String> = Vec::new();
    // A missing `Rowel/` or `Vaults/` is an account nothing has ever synced to,
    // which is the same answer as an empty folder.
    if let Some(root) = drive::folder_id(&client, &token, layout::ROOT_FOLDER).await? {
        if let Some(vaults) =
            drive::folder_id_in(&client, &token, layout::VAULTS_FOLDER, &root).await?
        {
            live = drive::list_folder(&client, &token, &vaults)
                .await?
                .iter()
                .filter_map(|file| layout::vault_id_of(&file.name).map(str::to_string))
                .collect();
        }
    }
    let live: Vec<&str> = live.iter().map(String::as_str).collect();

    match plan_vault_id(intent, local.vault_id()?.as_deref(), &live) {
        VaultIdPlan::Use(id) => Ok(Resolved { id, persist: false }),
        VaultIdPlan::Adopt(id) => Ok(Resolved { id, persist: true }),
        VaultIdPlan::Assign => Ok(Resolved {
            id: crate::crypto::random_hex_id(),
            persist: true,
        }),
        VaultIdPlan::Ambiguous => Err(Error::Other(ambiguous_vault_error())),
    }
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
    const OTHER: &str = "dddd";

    fn plan(local: Option<&str>, live: &[&str]) -> VaultIdPlan {
        plan_vault_id(Intent::Sync, local, live)
    }

    fn import(local: Option<&str>, live: &[&str]) -> VaultIdPlan {
        plan_vault_id(Intent::Import, local, live)
    }

    // --- an ordinary run -----------------------------------------------------

    #[test]
    fn a_vault_that_knows_its_id_simply_uses_it() {
        // Its pack is there; and if it is not, the first push creates it.
        assert_eq!(plan(Some(ID), &[ID]), VaultIdPlan::Use(ID.into()));
        assert_eq!(plan(Some(ID), &[]), VaultIdPlan::Use(ID.into()));
        // Another vault's pack in the folder is none of this one's business.
        assert_eq!(
            plan(Some(ID), &[OTHER, "eeee"]),
            VaultIdPlan::Use(ID.into())
        );
    }

    // The count is not evidence. A vault that has never synced has no claim on
    // whatever single pack the account happens to hold — it could be another
    // install's, and adopting it would push this vault's entries into it. The
    // user asks for that explicitly, by importing.
    #[test]
    fn a_vault_that_has_never_synced_mints_an_id_whatever_is_up_there() {
        assert_eq!(plan(None, &[]), VaultIdPlan::Assign);
        assert_eq!(plan(None, &[OTHER]), VaultIdPlan::Assign);
        assert_eq!(plan(None, &[OTHER, "eeee"]), VaultIdPlan::Assign);
    }

    // --- "Import from Drive" -------------------------------------------------

    // An import is asked by a vault that has an id of its own and, usually,
    // nothing in it. Keeping that id would find nothing to import.
    #[test]
    fn an_import_takes_on_the_one_vault_the_account_holds() {
        assert_eq!(import(Some(ID), &[OTHER]), VaultIdPlan::Adopt(OTHER.into()));
        assert_eq!(import(None, &[OTHER]), VaultIdPlan::Adopt(OTHER.into()));
        // Already that vault: nothing to take on, and no reason to re-point a
        // vault that is already syncing to its own pack.
        assert_eq!(import(Some(ID), &[ID]), VaultIdPlan::Use(ID.into()));
    }

    // The only way to reach it: an ordinary run never chooses between packs.
    #[test]
    fn an_import_refuses_to_guess_between_several_vaults() {
        assert_eq!(import(Some(ID), &[OTHER, "eeee"]), VaultIdPlan::Ambiguous);
        assert_eq!(import(None, &[OTHER, "eeee"]), VaultIdPlan::Ambiguous);
    }

    // With nothing under `Vaults/` there is nothing to import, so the same arms
    // as an ordinary run decide it.
    #[test]
    fn an_import_into_an_empty_account_behaves_like_a_sync() {
        assert_eq!(import(Some(ID), &[]), VaultIdPlan::Use(ID.into()));
        assert_eq!(import(None, &[]), VaultIdPlan::Assign);
    }
}
