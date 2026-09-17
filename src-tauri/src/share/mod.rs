//! Credential sharing by link: seal one entry, park it in the sender's own
//! Drive for a day, hand out a link that carries the key.
//!
//! [`envelope`] holds the crypto and the link format, [`remote`] the Drive
//! folder. This module is the verb layer between them — create, open, revoke,
//! sweep, list — and it is generic over the two transport traits so the whole
//! lifecycle is testable without a network.
//!
//! The link is the only secret: it never reaches Drive, and nothing here stores
//! it. What Drive holds is ciphertext plus a handful of opaque properties,
//! which is also the only ledger of outstanding shares — any device holding the
//! vault that published one can therefore list, revoke and clean it up, and a
//! reinstall loses nothing.

pub mod envelope;
pub mod remote;
#[cfg(test)]
mod tests;

use serde::Serialize;
use tauri::AppHandle;

use crate::crypto::Cryptor;
use crate::error::Result;
use crate::models::Entry;
use crate::sync::layout;
use envelope::{Link, ShareKey, SHARE_TTL_MS};
use remote::{
    DriveShareRemote, PublicFetch, ShareFile, ShareRemote, PROP_ENTRY_ID, PROP_EXPIRES_AT,
    PROP_KIND, PROP_SHARE, PROP_SHARE_VALUE, PROP_VAULT_ID,
};

/// A freshly published share, as the send dialog needs it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Created {
    /// The whole share in one pasteable token. Never persisted anywhere.
    pub link: String,
    /// Kept so the dialog can revoke without re-parsing the link.
    pub file_id: String,
    pub expires_at: String,
}

/// One outstanding share in the sender's own list.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveShare {
    pub file_id: String,
    /// The sender's local entry id, which the UI resolves to a title.
    pub entry_id: Option<String>,
    pub kind: Option<String>,
    /// The vault that published it, or `None` on a share made before the
    /// property existed. Carried through so the UI can tell the two apart.
    pub vault_id: Option<String>,
    pub created_at: String,
    pub expires_at: String,
}

/// Seal `entry` and publish it, returning the link that opens it.
///
/// `vault_id` is the sharing vault's own id, stamped on the file so that vault
/// can pick its shares out of an account several vaults now write into. `None`
/// omits the property, and the share behaves as every pre-`vaultId` one does.
pub fn create(
    remote: &impl ShareRemote,
    entry: &Entry,
    vault_id: Option<&str>,
    now_ms: i64,
) -> Result<Created> {
    envelope::check_shareable(entry)?;
    let key = ShareKey::generate();
    let expires_ms = envelope::expires_at(now_ms);
    let sealed = envelope::seal(&key, entry, expires_ms)?;

    // Read off the caller's entry, not the sealed copy: `seal` sanitizes the id
    // away, and this property is precisely what lets the sender's own list name
    // a share that carries no title. The marker property is how every share is
    // found again, whichever folder it landed in.
    let expires = expires_ms.to_string();
    let mut properties = vec![
        (PROP_SHARE, PROP_SHARE_VALUE),
        (PROP_ENTRY_ID, entry.id.as_str()),
        (PROP_KIND, entry.kind.as_str()),
        (PROP_EXPIRES_AT, expires.as_str()),
    ];
    if let Some(vault_id) = vault_id {
        properties.push((PROP_VAULT_ID, vault_id));
    }

    let file_id = remote.upload(&file_name(), &sealed, &properties)?;

    // An uploaded file nobody can read is worse than no share at all: the link
    // would go out and fail, and the orphan would sit in Drive until the sweep
    // dated it. Take it back before reporting the failure.
    if let Err(e) = remote.make_public(&file_id) {
        let _ = remote.delete(&file_id);
        return Err(e);
    }

    Ok(Created {
        expires_at: rfc3339(expires_ms),
        link: Link {
            file_id: file_id.clone(),
            key,
        }
        .format(),
        file_id,
    })
}

/// Turn a link into the entry it carries. The recipient's whole side of this:
/// the result is already sanitized and checked against `now_ms`, so the
/// frontend can hand it straight to the ordinary new-entry save.
pub fn open(fetch: &impl PublicFetch, link: &str, now_ms: i64) -> Result<Entry> {
    let link = Link::parse(link)?;
    let sealed = fetch.download(&link.file_id)?;
    envelope::unseal(&link.key, &sealed, now_ms)
}

/// Delete one share now, whatever its expiry. The link stops working.
pub fn revoke(remote: &impl ShareRemote, file_id: &str) -> Result<()> {
    remote.delete(file_id)
}

/// Delete every share whose expiry is known and has passed; returns how many.
pub fn sweep(remote: &impl ShareRemote, now_ms: i64) -> Result<usize> {
    let mut deleted = 0;
    for file in remote.list()? {
        // An absent expiry is "not known", never "expired": revoking a link the
        // sender is still handing out because we failed to date it would be a
        // far worse failure than leaving one file a day too long.
        if file.expires_ms.is_some_and(|at| at <= now_ms) {
            remote.delete(&file.id)?;
            deleted += 1;
        }
    }
    Ok(deleted)
}

/// This vault's outstanding shares, swept first so the list is never showing
/// something a recipient can no longer open.
///
/// The sweep above is account-wide — an expired share is dead wherever it came
/// from — but the list is not: an account can hold several vaults' shares now,
/// and a vault has no business revoking another's. A share carrying no
/// `vaultId` predates the property, so every vault keeps showing it; dropping
/// it from all of them would strand a link still in circulation.
pub fn list(
    remote: &impl ShareRemote,
    vault_id: Option<&str>,
    now_ms: i64,
) -> Result<Vec<ActiveShare>> {
    sweep(remote, now_ms)?;
    Ok(remote
        .list()?
        .iter()
        .filter(|file| match &file.vault_id {
            Some(owner) => Some(owner.as_str()) == vault_id,
            None => true,
        })
        .map(active_share)
        .collect())
}

fn active_share(file: &ShareFile) -> ActiveShare {
    ActiveShare {
        file_id: file.id.clone(),
        entry_id: file.entry_id.clone(),
        kind: file.kind.clone(),
        vault_id: file.vault_id.clone(),
        created_at: rfc3339(file.created_ms),
        // A share we could not date still has to tell the user when it goes:
        // the TTL from its creation is the expiry it was given, whether or not
        // the property survived.
        expires_at: rfc3339(
            file.expires_ms
                .unwrap_or_else(|| file.created_ms + SHARE_TTL_MS),
        ),
    }
}

/// A name that says nothing: random, and shaped by [`layout::share_file_name`]
/// like every other name Drive sees. Drive shows the owner a file list, so the
/// name carries no title — only enough randomness never to collide.
fn file_name() -> String {
    layout::share_file_name(&crate::crypto::random_hex_id())
}

fn rfc3339(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .unwrap_or(chrono::DateTime::UNIX_EPOCH)
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub(crate) fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn drive_remote(app: &AppHandle, cryptor: Cryptor) -> DriveShareRemote {
    DriveShareRemote::new(app.clone(), cryptor)
}

/// The sweep as the end of a sync run calls it.
pub fn sweep_drive(app: &AppHandle, cryptor: Cryptor) -> Result<usize> {
    sweep(&drive_remote(app, cryptor), now_ms())
}
