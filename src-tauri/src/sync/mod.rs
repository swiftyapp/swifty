//! Google Drive sync provider. Finds (or creates) `Rowel/Vaults/` and the
//! `<vault-id>.rowel` pack inside it, and reads/writes that one file. Every
//! name it uses comes from [`layout`].
//!
//! Which pack is *this* vault's is settled once per run, before the engine
//! starts: see [`resolve_vault_id`]. That step is also where an install still
//! keeping its pack at the pre-`Vaults/` `Rowel/vault.swsync` has it moved into
//! place — leaving a tombstone at the old name, so a device still on the old
//! build stops with "update the app" rather than quietly starting a second
//! vault ([`pack::tombstone`]) — so the rest of this module only ever knows the
//! one layout.
//!
//! The id that step settles on reaches the vault's `meta` table only *after*
//! the run it was settled for has succeeded (see [`run`]): until the pack has
//! been fetched, decoded and merged, nothing has proved it is this vault's.
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
    let resolved = block_on(resolve_vault_id(app, &cryptor, &local, intent))?;
    let remote = DriveRemote::new(app.clone(), cryptor, resolved.id.clone());
    let outcome = engine::sync(&remote, &local, now_ms())?;

    // The id is written *here*, on the far side of a whole successful run, and
    // nowhere earlier. An import that cannot reach, decode or merge the pack it
    // was pointed at leaves this vault answering to the id it already had,
    // rather than to a pack it has never seen a record of.
    //
    // The two ways that leaves the local vault behind both converge by
    // themselves on the next run:
    //
    // * A run that failed after the legacy pack was moved leaves this vault
    //   id-less and a tombstone naming the id the pack went to, so the next run
    //   plans `Adopt` on that same id and merges it.
    // * A run that failed after a plain `Assign` leaves this vault id-less and
    //   the account untouched, so the next run mints an id again. Nothing was
    //   pushed under the first one — the push is part of the run that failed.
    //
    // The price is that the pack this run pushed carries a snapshot taken
    // before the write, so the very first pack of an assigned or adopted vault
    // does not name its own id inside `meta`. The file name does, which is what
    // addresses it on Drive; a restore from such a pack takes the id from there
    // (`restore::adopt_vault_id_from_name`).
    if resolved.persist {
        // `adopt_vault_id` covers a minted id as well as one taken from the
        // remote: by the time the write happens they are both simply "the id
        // this run proved to be ours".
        local.adopt_vault_id(&resolved.id)?;
    }

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
    /// Mint an id. Nothing on the remote has anything to say about it.
    Assign,
    /// Take on an id the remote says is this vault's. The pull that follows is
    /// what brings its data in.
    Adopt(String),
    /// A legacy pack and no local id: mint one, and move the pack in under it.
    AssignAndMigrateLegacy,
    /// An import facing several live packs, with nothing to say which of them
    /// the user meant. Guessing would merge two vaults into one.
    Ambiguous,
}

/// What `Rowel/vault.swsync` is, as far as a listing can tell — which is as far
/// as this needs to tell, since the marker rides in `appProperties` and costs
/// no download.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Legacy {
    /// Not there: an account that was never written to by a pre-`Vaults/`
    /// build, or one whose migration has since been tidied away.
    Absent,
    /// A real pre-`Vaults/` pack, still waiting to be moved.
    Pack,
    /// The tombstone a migration left behind, naming the id the pack moved to.
    MovedTo(String),
}

/// Decide which vault id this run addresses.
///
/// `local` is the id in this vault's `meta` table, `legacy` what stands at
/// `Rowel/vault.swsync`, and `live` the ids of the packs found in `Vaults/` (an
/// absent folder is simply none of them).
///
/// The rule underneath the arms: a remote pack is only ever taken on when
/// something *says* it is this vault's — the user asking for it (an import), or
/// a tombstone this vault's own predecessor left. A pack that merely happens to
/// be the only one in the account is not evidence of anything.
fn plan_vault_id(
    intent: Intent,
    local: Option<&str>,
    legacy: &Legacy,
    live: &[&str],
) -> VaultIdPlan {
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
        // A vault with an id was born on a build that mints them, so it was
        // never the vault the pre-`Vaults/` pack belongs to — whatever else the
        // account holds, its own name is the answer. Migrating the legacy pack
        // under this id would file a stranger's vault under it, and the merge
        // would then refuse the very pack it had just renamed.
        Some(id) => VaultIdPlan::Use(id.to_string()),
        // No id: either this vault *is* the pre-`Vaults/` one, or a run of it
        // already moved that pack and failed before committing the id.
        None => match legacy {
            Legacy::Pack => VaultIdPlan::AssignAndMigrateLegacy,
            Legacy::MovedTo(id) => VaultIdPlan::Adopt(id.clone()),
            Legacy::Absent => VaultIdPlan::Assign,
        },
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
    /// written by [`resolve_vault_id`]: see [`run`], which writes it once the
    /// run it was resolved for has succeeded.
    persist: bool,
}

/// Settle the vault id for this run, doing whatever Drive work [`plan_vault_id`]
/// calls for.
///
/// The one place the two layouts meet: afterwards the account holds this
/// vault's pack under `Vaults/<id>.rowel` (or holds nothing yet, and the first
/// push puts it there). The *local* vault is not touched here at all — an id
/// this function minted lives in memory for as long as the run does, which is
/// what keeps a failed run from leaving a vault pointed at a pack it never read.
async fn resolve_vault_id(
    app: &AppHandle,
    cryptor: &Cryptor,
    local: &impl LocalVault,
    intent: Intent,
) -> Result<Resolved> {
    let client = http_client();
    let token = auth::access_token(&client, app, cryptor).await?;

    let root = drive::folder_id(&client, &token, layout::ROOT_FOLDER).await?;
    let mut legacy_file = None;
    let mut live: Vec<String> = Vec::new();
    if let Some(root) = &root {
        legacy_file = drive::find_file(&client, &token, layout::LEGACY_VAULT_FILE, root).await?;
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
    let legacy = legacy_state(legacy_file.as_ref());

    match plan_vault_id(intent, local.vault_id()?.as_deref(), &legacy, &live) {
        VaultIdPlan::Use(id) => Ok(Resolved { id, persist: false }),
        VaultIdPlan::Adopt(id) => Ok(Resolved { id, persist: true }),
        VaultIdPlan::Assign => Ok(Resolved {
            id: crate::crypto::random_hex_id(),
            persist: true,
        }),
        VaultIdPlan::AssignAndMigrateLegacy => {
            let id = crate::crypto::random_hex_id();
            // Both of these were read off the very listing the plan was made
            // from, so `Legacy::Pack` cannot be reached without them; the arm
            // is the type system's share of that argument, not a case.
            let (Some(root), Some(file)) = (root.as_deref(), &legacy_file) else {
                return Err(Error::Other("the legacy vault file went missing".into()));
            };
            migrate_legacy(&client, &token, root, &file.id, &id).await?;
            Ok(Resolved { id, persist: true })
        }
        VaultIdPlan::Ambiguous => Err(Error::Other(ambiguous_vault_error())),
    }
}

/// Read what stands at `Rowel/vault.swsync` out of the listing alone.
///
/// The `PROP_MOVED_TO` property is what tells a migrated file from a real pack,
/// and it comes back with every listing — so no build has to download a file to
/// find out it is not a vault.
fn legacy_state(file: Option<&drive::DriveFile>) -> Legacy {
    let Some(file) = file else {
        return Legacy::Absent;
    };
    match file.app_properties.get(layout::PROP_MOVED_TO) {
        Some(id) if !id.is_empty() => Legacy::MovedTo(id.clone()),
        _ => Legacy::Pack,
    }
}

/// Move the pre-`Vaults/` pack to `Vaults/<vault_id>.rowel` and leave a
/// tombstone standing in its place.
///
/// Moved, not re-uploaded: the file keeps its Drive id and its whole revision
/// history, so a user who wants yesterday's vault back still has it — and the
/// account is never left holding two packs, one of which quietly stops being
/// written to.
///
/// The tombstone is what the *other* devices read. Without it a device still on
/// the pre-`Vaults/` build finds nothing at the only name it knows, creates a
/// fresh `vault.swsync`, and from then on both devices sync happily to
/// different files; its content is a pack header that build cannot parse, so it
/// stops with "update the app" instead. Its `PROP_MOVED_TO` property does the
/// same job for devices that *are* upgraded, pointing them at the id the pack
/// now answers to (see [`pack::tombstone`] and [`legacy_state`]).
async fn migrate_legacy(
    client: &Client,
    token: &str,
    root: &str,
    legacy_file_id: &str,
    vault_id: &str,
) -> Result<()> {
    let vaults = ensure_vaults_folder(client, token, root).await?;
    let name = layout::vault_file_name(vault_id);
    drive::move_file(client, token, legacy_file_id, &name, root, &vaults).await?;

    // A migration that cannot leave its marker is undone rather than left
    // half-done. The moved pack alone is not evidence of anything — this run's
    // id is not committed yet, and an id-less vault never adopts a pack just
    // for being the only one there — so the next run would mint a second vault
    // beside the user's data. Putting the pack back leaves exactly the state
    // this started from, and the next run migrates it again.
    if let Err(e) = leave_tombstone(client, token, root, vault_id).await {
        let put_back = drive::move_file(
            client,
            token,
            legacy_file_id,
            layout::LEGACY_VAULT_FILE,
            &vaults,
            root,
        )
        .await;
        if let Err(undo) = put_back {
            log::warn!("the legacy pack could not be put back after a failed migration: {undo}");
        }
        return Err(e);
    }
    Ok(())
}

// The marker itself: content for old builds, property for new ones. It goes up
// as an opaque blob rather than under the vault MIME type, because it is
// precisely not a vault.
async fn leave_tombstone(client: &Client, token: &str, root: &str, vault_id: &str) -> Result<()> {
    drive::create_file_with_properties(
        client,
        token,
        layout::LEGACY_VAULT_FILE,
        root,
        &pack::tombstone(vault_id),
        &[(layout::PROP_MOVED_TO, vault_id)],
    )
    .await
    .map(|_| ())
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
    use super::{legacy_state, plan_vault_id, Intent, Legacy, VaultIdPlan};
    use crate::sync::drive::DriveFile;
    use crate::sync::layout;

    const ID: &str = "a1b2c3";
    const OTHER: &str = "dddd";

    fn plan(local: Option<&str>, legacy: Legacy, live: &[&str]) -> VaultIdPlan {
        plan_vault_id(Intent::Sync, local, &legacy, live)
    }

    fn import(local: Option<&str>, legacy: Legacy, live: &[&str]) -> VaultIdPlan {
        plan_vault_id(Intent::Import, local, &legacy, live)
    }

    // --- a vault that knows its own name ------------------------------------

    #[test]
    fn a_vault_that_knows_its_id_simply_uses_it() {
        // Its pack is there; and if it is not, the first push creates it.
        assert_eq!(
            plan(Some(ID), Legacy::Absent, &[ID]),
            VaultIdPlan::Use(ID.into())
        );
        assert_eq!(
            plan(Some(ID), Legacy::Absent, &[]),
            VaultIdPlan::Use(ID.into())
        );
        // Another vault's pack in the folder is none of this one's business.
        assert_eq!(
            plan(Some(ID), Legacy::Absent, &[OTHER, "eeee"]),
            VaultIdPlan::Use(ID.into())
        );
    }

    // A vault that has an id was created on a build that mints them, so the
    // pre-`Vaults/` pack is somebody else's history: taking it over would file
    // it under this vault's name and then fail to merge it, having already
    // broken the promise that starting fresh leaves the old vault alone.
    #[test]
    fn a_vault_with_an_id_never_takes_over_the_legacy_pack() {
        assert_eq!(
            plan(Some(ID), Legacy::Pack, &[]),
            VaultIdPlan::Use(ID.into())
        );
        assert_eq!(
            plan(Some(ID), Legacy::Pack, &[ID]),
            VaultIdPlan::Use(ID.into())
        );
        assert_eq!(
            plan(Some(ID), Legacy::MovedTo(OTHER.into()), &[OTHER]),
            VaultIdPlan::Use(ID.into())
        );
    }

    // --- an id-less vault ----------------------------------------------------

    #[test]
    fn a_vault_from_before_ids_takes_the_legacy_pack_with_it() {
        assert_eq!(
            plan(None, Legacy::Pack, &[]),
            VaultIdPlan::AssignAndMigrateLegacy
        );
    }

    // The tombstone is this vault's own migration, seen from the far side of a
    // run that moved the pack and then failed before committing the id.
    #[test]
    fn an_idless_vault_follows_the_tombstone_to_the_moved_pack() {
        assert_eq!(
            plan(None, Legacy::MovedTo(OTHER.into()), &[OTHER]),
            VaultIdPlan::Adopt(OTHER.into())
        );
        // The pack it names has since been archived or deleted; addressing it
        // anyway keeps the two devices on one name, and the first push recreates it.
        assert_eq!(
            plan(None, Legacy::MovedTo(OTHER.into()), &[]),
            VaultIdPlan::Adopt(OTHER.into())
        );
    }

    #[test]
    fn an_idless_vault_with_no_legacy_file_mints_an_id() {
        assert_eq!(plan(None, Legacy::Absent, &[]), VaultIdPlan::Assign);
    }

    // The count is not evidence. A vault that has never synced and was never
    // the legacy one has no claim on whatever single pack the account happens
    // to hold — it could be another install's, and adopting it would push this
    // vault's entries into it. The user asks for that explicitly, by importing.
    #[test]
    fn an_idless_vault_does_not_adopt_a_pack_just_for_being_the_only_one() {
        assert_eq!(plan(None, Legacy::Absent, &[OTHER]), VaultIdPlan::Assign);
        assert_eq!(
            plan(None, Legacy::Absent, &[OTHER, "eeee"]),
            VaultIdPlan::Assign
        );
    }

    // --- "Import from Drive" -------------------------------------------------

    // An import is asked by a vault that has an id of its own and, usually,
    // nothing in it. Keeping that id would find nothing to import.
    #[test]
    fn an_import_takes_on_the_one_vault_the_account_holds() {
        assert_eq!(
            import(Some(ID), Legacy::Absent, &[OTHER]),
            VaultIdPlan::Adopt(OTHER.into())
        );
        assert_eq!(
            import(None, Legacy::Absent, &[OTHER]),
            VaultIdPlan::Adopt(OTHER.into())
        );
        // Already that vault: nothing to take on, and no reason to re-point a
        // vault that is already syncing to its own pack.
        assert_eq!(
            import(Some(ID), Legacy::Absent, &[ID]),
            VaultIdPlan::Use(ID.into())
        );
    }

    // The only way to reach it: an ordinary run never chooses between packs.
    #[test]
    fn an_import_refuses_to_guess_between_several_vaults() {
        assert_eq!(
            import(Some(ID), Legacy::Absent, &[OTHER, "eeee"]),
            VaultIdPlan::Ambiguous
        );
        assert_eq!(
            import(None, Legacy::Absent, &[OTHER, "eeee"]),
            VaultIdPlan::Ambiguous
        );
    }

    // With nothing under `Vaults/` an import is an ordinary run: the same
    // arms decide it, legacy pack and all.
    #[test]
    fn an_import_into_an_empty_account_behaves_like_a_sync() {
        assert_eq!(
            import(Some(ID), Legacy::Absent, &[]),
            VaultIdPlan::Use(ID.into())
        );
        assert_eq!(
            import(Some(ID), Legacy::Pack, &[]),
            VaultIdPlan::Use(ID.into())
        );
        assert_eq!(
            import(None, Legacy::Pack, &[]),
            VaultIdPlan::AssignAndMigrateLegacy
        );
    }

    // --- reading the legacy file off a listing -------------------------------

    fn legacy_file(properties: &[(&str, &str)]) -> DriveFile {
        DriveFile {
            id: "file-1".into(),
            name: layout::LEGACY_VAULT_FILE.into(),
            created_time: "2024-01-01T00:00:00Z".into(),
            modified_time: String::new(),
            size: None,
            head_revision: None,
            app_properties: properties
                .iter()
                .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
                .collect(),
        }
    }

    #[test]
    fn the_marker_alone_tells_a_tombstone_from_a_pack() {
        assert_eq!(legacy_state(None), Legacy::Absent);
        assert_eq!(legacy_state(Some(&legacy_file(&[]))), Legacy::Pack);
        assert_eq!(
            legacy_state(Some(&legacy_file(&[(layout::PROP_MOVED_TO, ID)]))),
            Legacy::MovedTo(ID.into())
        );
        // A marker with nothing in it names no vault, so the file is taken at
        // face value: a pack, which is the answer that loses nothing.
        assert_eq!(
            legacy_state(Some(&legacy_file(&[(layout::PROP_MOVED_TO, "")]))),
            Legacy::Pack
        );
    }
}
