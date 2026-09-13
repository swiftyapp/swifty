//! Where a one-time share lives while it is outstanding: a `Shares` subfolder
//! of the same `Swifty` Drive folder sync already uses.
//!
//! The sender uploads sealed bytes and makes the file link-readable; the
//! recipient — who has no Google account — fetches it with a public API key.
//! Drive only ever holds ciphertext plus opaque bookkeeping (an entry UUID, a
//! kind, an expiry), so the folder listing tells the *sender's* UI what is
//! outstanding without telling Google what was shared.
//!
//! Like `sync`, this is only the transport: the Drive calls are async and are
//! driven with `block_on` behind synchronous traits, which is safe because
//! commands run them on `spawn_blocking` threads, never on a runtime worker.

use std::sync::Mutex;

use reqwest::Client;
use tauri::{async_runtime::block_on, AppHandle};

use crate::crypto::Cryptor;
use crate::error::{Error, Result};
use crate::sync::drive::{self, DriveFile};
use crate::sync::{access_token, http_client, FOLDER_NAME};

/// The subfolder of `Swifty` that holds outstanding shares.
pub const SHARES_FOLDER: &str = "Shares";

/// `appProperties` keys on a share file. Values are opaque to Google.
pub const PROP_ENTRY_ID: &str = "entryId";
pub const PROP_KIND: &str = "kind";
pub const PROP_EXPIRES_AT: &str = "expiresAt";
/// The marker every share carries, and the only thing a listing selects on:
/// shares are found by it wherever they sit, so a duplicate `Shares` folder
/// created by a racing device hides nothing from the sweep or the revoke list.
pub const PROP_SHARE: &str = "swiftyShare";
pub const PROP_SHARE_VALUE: &str = "1";

/// The most a share file may be. An entry is a few kilobytes; an `.env` file
/// a few hundred at the outside. The id in a pasted link can name any public
/// file on Drive, so the recipient never buffers more than this.
pub const MAX_SHARE_BYTES: usize = 2 * 1024 * 1024;

/// How long the recipient waits on Drive before giving up.
const FETCH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

/// One outstanding share, as the sender's UI sees it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShareFile {
    pub id: String,
    /// The sender's local entry id from appProperties (`entryId`), if present.
    /// An opaque UUID: the sender's UI resolves it to a title; Google learns
    /// nothing.
    pub entry_id: Option<String>,
    /// Entry kind from appProperties (`kind`), e.g. "login".
    pub kind: Option<String>,
    pub created_ms: i64,
    /// Absent when the file predates expiry bookkeeping or carries a malformed
    /// value — treated as "no known expiry" rather than "expired now", so a
    /// sweep never deletes a share it simply failed to read.
    pub expires_ms: Option<i64>,
}

/// The sender-side store of outstanding shares.
pub trait ShareRemote {
    /// Upload sealed bytes as a new share file; returns the Drive file id.
    fn upload(&self, name: &str, bytes: &[u8], properties: &[(&str, &str)]) -> Result<String>;
    /// Make the file readable by anyone holding its id.
    fn make_public(&self, id: &str) -> Result<()>;
    fn delete(&self, id: &str) -> Result<()>;
    /// Every share file currently in the Shares folder.
    fn list(&self) -> Result<Vec<ShareFile>>;
}

/// Recipient side: no account, just the public download.
pub trait PublicFetch {
    fn download(&self, file_id: &str) -> Result<Vec<u8>>;
}

/// Read a listed Drive file as a share. Pure: every field is already in the
/// listing, so neither the UI nor the sweep needs a second round trip.
pub fn parse_share_file(file: &DriveFile) -> ShareFile {
    ShareFile {
        id: file.id.clone(),
        entry_id: file.app_properties.get(PROP_ENTRY_ID).cloned(),
        kind: file.app_properties.get(PROP_KIND).cloned(),
        created_ms: chrono::DateTime::parse_from_rfc3339(&file.created_time)
            .map(|t| t.timestamp_millis())
            .unwrap_or(0),
        expires_ms: file
            .app_properties
            .get(PROP_EXPIRES_AT)
            .and_then(|v| v.parse().ok()),
    }
}

/// [`ShareRemote`] over the `Swifty/Shares` folder of the connected account.
///
/// The folder id is resolved once per instance and cached: unlike the sync
/// pack, a share file is addressed by the id upload just returned, so nothing
/// here has to observe another device's writes mid-operation.
pub struct DriveShareRemote {
    app: AppHandle,
    cryptor: Cryptor,
    folder: Mutex<Option<String>>,
}

impl DriveShareRemote {
    pub fn new(app: AppHandle, cryptor: Cryptor) -> Self {
        Self {
            app,
            cryptor,
            folder: Mutex::new(None),
        }
    }

    async fn token(&self, client: &Client) -> Result<String> {
        access_token(client, &self.app, &self.cryptor).await
    }

    /// `Swifty/Shares`, if it exists. Never creates: every sync run sweeps, and
    /// most users never share, so a listing must not leave a folder behind in
    /// an account that has nothing to list.
    async fn find_folder(&self, client: &Client, token: &str) -> Result<Option<String>> {
        if let Some(id) = self.folder.lock().unwrap().clone() {
            return Ok(Some(id));
        }
        let Some(root) = drive::folder_id(client, token, FOLDER_NAME).await? else {
            return Ok(None);
        };
        let shares = drive::folder_id_in(client, token, SHARES_FOLDER, &root).await?;
        if let Some(id) = &shares {
            *self.folder.lock().unwrap() = Some(id.clone());
        }
        Ok(shares)
    }

    /// Find-or-create `Swifty/Shares`, for the upload path only. Creating is the
    /// normal case the first time a user shares anything, including before
    /// they have ever synced.
    async fn ensure_folder(&self, client: &Client, token: &str) -> Result<String> {
        if let Some(id) = self.find_folder(client, token).await? {
            return Ok(id);
        }
        let root = match drive::folder_id(client, token, FOLDER_NAME).await? {
            Some(id) => id,
            None => drive::create_folder(client, token, FOLDER_NAME).await?,
        };
        let shares = drive::create_folder_in(client, token, SHARES_FOLDER, Some(&root)).await?;
        *self.folder.lock().unwrap() = Some(shares.clone());
        Ok(shares)
    }
}

impl ShareRemote for DriveShareRemote {
    fn upload(&self, name: &str, bytes: &[u8], properties: &[(&str, &str)]) -> Result<String> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            let folder = self.ensure_folder(&client, &token).await?;
            let file = drive::create_file_with_properties(
                &client, &token, name, &folder, bytes, properties,
            )
            .await?;
            Ok(file.id)
        })
    }

    fn make_public(&self, id: &str) -> Result<()> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            drive::share_with_anyone(&client, &token, id).await
        })
    }

    fn delete(&self, id: &str) -> Result<()> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            drive::delete_file(&client, &token, id).await
        })
    }

    fn list(&self) -> Result<Vec<ShareFile>> {
        block_on(async {
            let client = http_client();
            let token = self.token(&client).await?;
            let files =
                drive::find_by_app_property(&client, &token, PROP_SHARE, PROP_SHARE_VALUE).await?;
            Ok(files.iter().map(parse_share_file).collect())
        })
    }
}

/// The recipient's fetcher. Holds no account state — an API key is all a
/// link-shared download needs.
pub struct DrivePublicFetch;

impl PublicFetch for DrivePublicFetch {
    fn download(&self, file_id: &str) -> Result<Vec<u8>> {
        let key = api_key()?;
        block_on(async {
            // Not the shared client: this request is made on a stranger's
            // say-so, so it gets a deadline the account-bound calls do not.
            crate::sync::install_crypto_provider();
            let client = Client::builder()
                .timeout(FETCH_TIMEOUT)
                .build()
                .map_err(|e| Error::Other(e.to_string()))?;
            drive::download_public(&client, &key, file_id, MAX_SHARE_BYTES).await
        })
    }
}

/// The Google API key this build downloads with, from the environment at run
/// time or baked in at build time. A public identifier, not a secret: it names
/// the project for quota and grants nothing on its own. Mirrors the OAuth
/// client resolution in `sync::auth`.
fn api_key() -> Result<String> {
    std::env::var("GOOGLE_API_KEY")
        .ok()
        .or_else(|| option_env!("GOOGLE_API_KEY").map(String::from))
        .filter(|key| !key.is_empty())
        .ok_or_else(|| Error::Other("Google API key not configured; set GOOGLE_API_KEY".into()))
}

/// An in-memory stand-in for the Drive folder, implementing both sides of the
/// exchange so a test can upload, publish and download without a network.
///
/// `download` is deliberately strict about the public flag: a share that was
/// never published is exactly as unreachable to a recipient as one that was
/// deleted, and it fails with the same message the real client gives.
#[cfg(test)]
pub(crate) struct FakeShareRemote {
    files: Mutex<std::collections::BTreeMap<String, FakeFile>>,
    /// Doubles as the id source and the createdTime clock, so uploads are
    /// ordered and ids are stable across a test.
    next: Mutex<i64>,
    /// Fails `make_public`, for the caller that has to clean up after it.
    fail_publishing: std::sync::atomic::AtomicBool,
}

#[cfg(test)]
pub(crate) struct FakeFile {
    pub bytes: Vec<u8>,
    pub properties: std::collections::BTreeMap<String, String>,
    pub public: bool,
    pub created_ms: i64,
}

#[cfg(test)]
impl FakeShareRemote {
    pub(crate) fn new() -> Self {
        Self {
            files: Mutex::new(Default::default()),
            next: Mutex::new(1),
            fail_publishing: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Make every later `make_public` fail, leaving the upload behind.
    pub(crate) fn fail_publishing(&self) {
        self.fail_publishing
            .store(true, std::sync::atomic::Ordering::SeqCst);
    }

    /// Ids of every file currently held, oldest first.
    pub(crate) fn ids(&self) -> Vec<String> {
        self.files.lock().unwrap().keys().cloned().collect()
    }

    pub(crate) fn is_public(&self, id: &str) -> bool {
        self.files.lock().unwrap().get(id).is_some_and(|f| f.public)
    }

    pub(crate) fn bytes(&self, id: &str) -> Option<Vec<u8>> {
        self.files.lock().unwrap().get(id).map(|f| f.bytes.clone())
    }
}

#[cfg(test)]
impl ShareRemote for FakeShareRemote {
    fn upload(&self, _name: &str, bytes: &[u8], properties: &[(&str, &str)]) -> Result<String> {
        let mut next = self.next.lock().unwrap();
        let id = format!("file-{next}");
        self.files.lock().unwrap().insert(
            id.clone(),
            FakeFile {
                bytes: bytes.to_vec(),
                properties: properties
                    .iter()
                    .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
                    .collect(),
                public: false,
                created_ms: *next,
            },
        );
        *next += 1;
        Ok(id)
    }

    fn make_public(&self, id: &str) -> Result<()> {
        if self
            .fail_publishing
            .load(std::sync::atomic::Ordering::SeqCst)
        {
            return Err(Error::Other("could not publish the share".into()));
        }
        match self.files.lock().unwrap().get_mut(id) {
            Some(file) => {
                file.public = true;
                Ok(())
            }
            None => Err(Error::NotFound),
        }
    }

    fn delete(&self, id: &str) -> Result<()> {
        self.files.lock().unwrap().remove(id);
        Ok(())
    }

    // Selects on the marker exactly as the real listing does, so a caller that
    // forgets to set it finds out here.
    fn list(&self) -> Result<Vec<ShareFile>> {
        Ok(self
            .files
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, file)| {
                file.properties.get(PROP_SHARE).map(String::as_str) == Some(PROP_SHARE_VALUE)
            })
            .map(|(id, file)| ShareFile {
                id: id.clone(),
                entry_id: file.properties.get(PROP_ENTRY_ID).cloned(),
                kind: file.properties.get(PROP_KIND).cloned(),
                created_ms: file.created_ms,
                expires_ms: file
                    .properties
                    .get(PROP_EXPIRES_AT)
                    .and_then(|v| v.parse().ok()),
            })
            .collect())
    }
}

#[cfg(test)]
impl PublicFetch for FakeShareRemote {
    fn download(&self, file_id: &str) -> Result<Vec<u8>> {
        self.files
            .lock()
            .unwrap()
            .get(file_id)
            .filter(|f| f.public)
            .map(|f| f.bytes.clone())
            .ok_or_else(|| Error::Other(drive::SHARE_GONE.into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn drive_file(created: &str, properties: &[(&str, &str)]) -> DriveFile {
        DriveFile {
            id: "f1".into(),
            name: "share.swshare".into(),
            created_time: created.into(),
            head_revision: None,
            app_properties: properties
                .iter()
                .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
                .collect::<BTreeMap<_, _>>(),
        }
    }

    #[test]
    fn a_share_file_is_read_out_of_the_listing_alone() {
        let parsed = parse_share_file(&drive_file(
            "2024-03-01T12:00:00.000Z",
            &[
                (PROP_ENTRY_ID, "entry-uuid"),
                (PROP_KIND, "login"),
                (PROP_EXPIRES_AT, "1709300000000"),
            ],
        ));

        assert_eq!(parsed.id, "f1");
        assert_eq!(parsed.entry_id.as_deref(), Some("entry-uuid"));
        assert_eq!(parsed.kind.as_deref(), Some("login"));
        assert_eq!(parsed.created_ms, 1_709_294_400_000);
        assert_eq!(parsed.expires_ms, Some(1_709_300_000_000));
    }

    #[test]
    fn a_share_without_properties_reads_as_unknown_rather_than_failing() {
        let parsed = parse_share_file(&drive_file("2024-03-01T12:00:00.000Z", &[]));
        assert_eq!(parsed.entry_id, None);
        assert_eq!(parsed.kind, None);
        assert_eq!(parsed.expires_ms, None);
    }

    // A file the sweep cannot date must not read as "expired long ago".
    #[test]
    fn malformed_times_degrade_to_epoch_and_no_expiry() {
        let parsed = parse_share_file(&drive_file("not a time", &[(PROP_EXPIRES_AT, "soon")]));
        assert_eq!(parsed.created_ms, 0);
        assert_eq!(parsed.expires_ms, None);
    }

    #[test]
    fn an_uploaded_share_is_listed_with_its_properties() {
        let remote = FakeShareRemote::new();
        let id = remote
            .upload(
                "share.swshare",
                b"sealed",
                &[
                    (PROP_SHARE, PROP_SHARE_VALUE),
                    (PROP_ENTRY_ID, "entry-1"),
                    (PROP_KIND, "login"),
                ],
            )
            .unwrap();
        // Uploaded without the marker: present, but not a share to the listing.
        remote.upload("stray.bin", b"x", &[]).unwrap();

        let listed = remote.list().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, id);
        assert_eq!(listed[0].entry_id.as_deref(), Some("entry-1"));
        assert_eq!(listed[0].kind.as_deref(), Some("login"));
        // Both files are held; only one is a share.
        assert_eq!(remote.ids().len(), 2);
    }

    #[test]
    fn publishing_is_what_makes_a_share_downloadable() {
        let remote = FakeShareRemote::new();
        let id = remote.upload("share.swshare", b"sealed", &[]).unwrap();

        assert!(!remote.is_public(&id));
        assert!(remote.download(&id).is_err());

        remote.make_public(&id).unwrap();
        assert!(remote.is_public(&id));
        assert_eq!(remote.download(&id).unwrap(), b"sealed");
        assert_eq!(remote.bytes(&id).unwrap(), b"sealed");
    }

    #[test]
    fn an_unknown_or_revoked_share_fails_the_way_the_recipient_is_told() {
        let remote = FakeShareRemote::new();
        let id = remote.upload("share.swshare", b"sealed", &[]).unwrap();
        remote.make_public(&id).unwrap();
        remote.delete(&id).unwrap();

        for missing in [id.as_str(), "never-existed"] {
            let err = remote.download(missing).unwrap_err().to_string();
            assert_eq!(err, "this share has expired or was revoked");
        }
    }

    #[test]
    fn deleting_removes_the_share_and_deleting_twice_is_fine() {
        let remote = FakeShareRemote::new();
        let id = remote.upload("share.swshare", b"sealed", &[]).unwrap();

        remote.delete(&id).unwrap();
        assert!(remote.list().unwrap().is_empty());
        assert!(remote.ids().is_empty());
        // Revoke and the expiry sweep race each other; whoever loses still
        // got what it asked for.
        remote.delete(&id).unwrap();
        remote.delete("never-existed").unwrap();
    }
}
