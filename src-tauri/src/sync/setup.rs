//! What a *keyless* install can ask of a connected Drive account.
//!
//! During first-run onboarding there is no vault, so none of the usual entry
//! points apply: [`super::run`] needs a session cryptor to read the token file
//! with, and the token file itself cannot exist until a vault key does. The
//! three questions onboarding actually has — is there a vault up there, give me
//! its bytes, move it aside — are answered here against [`drive`] directly,
//! with an access token the caller holds in memory.
//!
//! (Not to be confused with [`super::setup`], the desktop consent flow for an
//! install that already has a vault.)

use reqwest::Client;
use serde::Serialize;

use super::{drive, pack, FOLDER_NAME};
use crate::error::Result;

/// A remote vault as the onboarding screen describes it — enough for the user
/// to recognise the account as theirs, without downloading a byte.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackInfo {
    pub name: String,
    /// `0` when Drive reported no length. Onboarding only renders this, and a
    /// missing size is not worth a second shape in the payload.
    pub size: u64,
    /// RFC 3339 UTC, as Drive gives it; the frontend formats it.
    pub modified_time: String,
}

impl From<&drive::DriveFile> for PackInfo {
    fn from(file: &drive::DriveFile) -> Self {
        Self {
            name: file.name.clone(),
            size: file.size.unwrap_or(0),
            modified_time: file.modified_time.clone(),
        }
    }
}

/// The account's `Swifty/vault.swsync`, if it has one.
///
/// `None` covers both "no Swifty folder" and "a folder with no pack in it" —
/// to onboarding they are the same answer, and the same fresh start.
pub async fn find_pack(client: &Client, token: &str) -> Result<Option<drive::DriveFile>> {
    let Some(folder) = drive::folder_id(client, token, FOLDER_NAME).await? else {
        return Ok(None);
    };
    drive::find_file(client, token, pack::FILE_NAME, &folder).await
}

/// Download a pack located by [`find_pack`].
pub async fn download_pack(client: &Client, token: &str, id: &str) -> Result<Vec<u8>> {
    drive::read_file(client, token, id).await
}

/// Move a pre-existing remote vault aside so a newly created one can take its
/// place, under a name that says what it is and when it was set aside.
///
/// A rename, not a delete: the user is choosing to start over, not to destroy
/// whatever the account already held, and this is their own Drive — the
/// archived pack stays in the same folder for them to restore or bin later.
pub async fn archive_pack(client: &Client, token: &str, id: &str, today: &str) -> Result<()> {
    drive::rename_file(client, token, id, &archive_name(today)).await
}

/// The archived name for a pack set aside on `date` (`YYYY-MM-DD`, UTC).
///
/// Same-day collisions are fine: Drive allows same-name siblings, so a second
/// archive on one day sits beside the first rather than replacing it.
fn archive_name(date: &str) -> String {
    format!("vault-archived-{date}.swsync")
}

/// Today in UTC, as [`archive_name`] wants it. UTC rather than local time so
/// two devices archiving the same account agree on the name.
pub fn today_utc() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_archived_pack_is_named_for_the_day_it_was_set_aside() {
        assert_eq!(
            archive_name("2024-05-04"),
            "vault-archived-2024-05-04.swsync"
        );
        // Same extension as the live pack, so the archive is still recognisably
        // a Swifty vault the user could restore from.
        assert!(archive_name("2024-05-04")
            .ends_with(&format!(".{}", pack::FILE_NAME.rsplit('.').next().unwrap())));
    }

    #[test]
    fn todays_archive_name_is_a_utc_date() {
        let today = today_utc();
        assert_eq!(today.len(), 10, "{today}");
        assert_eq!(today.matches('-').count(), 2, "{today}");
        assert_eq!(today, chrono::Utc::now().format("%Y-%m-%d").to_string());
    }

    #[test]
    fn a_listed_pack_describes_itself_to_onboarding() {
        let file = drive::DriveFile {
            id: "f1".into(),
            name: "vault.swsync".into(),
            created_time: "2024-01-01T00:00:00.000Z".into(),
            modified_time: "2024-05-04T10:11:12.000Z".into(),
            size: Some(2048),
            head_revision: None,
            app_properties: Default::default(),
        };
        let info = PackInfo::from(&file);
        assert_eq!(info.name, "vault.swsync");
        assert_eq!(info.size, 2048);
        assert_eq!(info.modified_time, "2024-05-04T10:11:12.000Z");

        // Payload keys are the frontend's contract.
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["name"], "vault.swsync");
        assert_eq!(json["size"], 2048);
        assert_eq!(json["modifiedTime"], "2024-05-04T10:11:12.000Z");
    }

    // A `size` Drive did not report reads as 0 rather than breaking the shape
    // the frontend destructures.
    #[test]
    fn a_pack_of_unknown_size_reports_zero() {
        let file = drive::DriveFile {
            id: "f1".into(),
            name: "vault.swsync".into(),
            created_time: String::new(),
            modified_time: String::new(),
            size: None,
            head_revision: None,
            app_properties: Default::default(),
        };
        assert_eq!(PackInfo::from(&file).size, 0);
    }
}
