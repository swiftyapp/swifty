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

use super::{drive, layout, pack};
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

/// The pack in `Rowel/Vaults/` this install could restore from, if the account
/// holds one.
///
/// `None` covers "no Rowel folder", "no Vaults/ in it" and "a Vaults/ with
/// nothing restorable in it" — to onboarding they are the same answer, and the
/// same fresh start.
pub async fn find_pack(client: &Client, token: &str) -> Result<Option<drive::DriveFile>> {
    let Some(root) = drive::folder_id(client, token, layout::ROOT_FOLDER).await? else {
        return Ok(None);
    };
    if let Some(pack) = find_in_vaults(client, token, &root).await? {
        return Ok(Some(pack));
    }
    // Fall back to the pre-`Vaults/` location, for an account nobody has synced
    // since the upgrade: its pack still sits directly in `Rowel/` under the old
    // name, and a first run that could not see it would offer to start fresh
    // over a vault the user very much still has. The sync engine moves the file
    // into place on its next run, so this fallback goes with the rest of the
    // legacy layout in a later cleanup.
    drive::find_file(client, token, layout::LEGACY_VAULT_FILE, &root).await
}

/// The live pack in `Rowel/Vaults/`, if that folder exists and holds one.
async fn find_in_vaults(
    client: &Client,
    token: &str,
    root: &str,
) -> Result<Option<drive::DriveFile>> {
    let Some(vaults) = drive::folder_id_in(client, token, layout::VAULTS_FOLDER, root).await?
    else {
        return Ok(None);
    };
    Ok(oldest_live_pack(
        drive::list_files(client, token, &vaults).await?,
    ))
}

/// The one pack of `Rowel/Vaults/` onboarding offers to restore.
///
/// Live packs only: an archived pack is a vault the user deliberately set
/// aside, and [`layout::vault_id_of`] is what tells the two apart.
///
/// A stop-gap while more than one live pack cannot happen: sync covers the
/// primary workspace alone, so an account holds one vault. If it somehow holds
/// several, the oldest wins — the same rule the rest of `drive` settles ties
/// with, and `created_time` is RFC 3339 UTC, a fixed-width format whose
/// lexicographic order *is* chronological order. A follow-up will list them all
/// and let the user pick instead of choosing for them.
fn oldest_live_pack(files: Vec<drive::DriveFile>) -> Option<drive::DriveFile> {
    files
        .into_iter()
        .filter(|file| layout::vault_id_of(&file.name).is_some())
        .min_by(|a, b| {
            a.created_time
                .cmp(&b.created_time)
                .then_with(|| a.id.cmp(&b.id))
        })
}

/// Download a pack located by [`find_pack`], under the same size cap the sync
/// engine applies.
pub async fn download_pack(client: &Client, token: &str, id: &str) -> Result<Vec<u8>> {
    drive::read_file(client, token, id, pack::MAX_PACK_BYTES).await
}

/// Move a pre-existing remote vault aside so a newly created one can take its
/// place, under a name that says what it is and when it was set aside.
///
/// A rename, not a delete: the user is choosing to start over, not to destroy
/// whatever the account already held, and this is their own Drive — the
/// archived pack stays in the same folder for them to restore or bin later.
///
/// The whole file, not just its id, because the archived name is built from the
/// name it already has: a pack keeps its vault id, and the legacy file keeps
/// its stem. Same-day collisions are fine — Drive allows same-name siblings, so
/// a second archive on one day sits beside the first rather than replacing it.
pub async fn archive_pack(
    client: &Client,
    token: &str,
    file: &drive::DriveFile,
    today: &str,
) -> Result<()> {
    let name = layout::archived_file_name(&file.name, today);
    drive::rename_file(client, token, &file.id, &name).await
}

/// Today in UTC, as [`archive_pack`] wants it. UTC rather than local time so
/// two devices archiving the same account agree on the name.
pub fn today_utc() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn drive_file(id: &str, name: &str, created: &str) -> drive::DriveFile {
        drive::DriveFile {
            id: id.into(),
            name: name.into(),
            created_time: created.into(),
            modified_time: String::new(),
            size: None,
            head_revision: None,
            app_properties: Default::default(),
        }
    }

    // What "start fresh" leaves behind: the pack keeps its vault id, the legacy
    // file keeps its stem, and both take the day they were set aside.
    #[test]
    fn an_archived_pack_is_named_for_the_day_it_was_set_aside() {
        assert_eq!(
            layout::archived_file_name("a1b2.rowel", "2024-05-04"),
            "a1b2-archived-2024-05-04.rowel"
        );
        assert_eq!(
            layout::archived_file_name(layout::LEGACY_VAULT_FILE, "2024-05-04"),
            "vault-archived-2024-05-04.rowel"
        );
        // Same extension as a live pack, so the archive is still recognisably a
        // Rowel vault the user could restore from.
        assert!(
            layout::archived_file_name(layout::LEGACY_VAULT_FILE, "2024-05-04")
                .ends_with(&format!(".{}", layout::VAULT_EXTENSION))
        );
    }

    // One vault in the account is the case that exists today.
    #[test]
    fn the_single_live_pack_is_the_one_to_restore() {
        let pack = drive_file("f1", "a1b2.rowel", "2024-01-01T00:00:00.000Z");
        assert_eq!(oldest_live_pack(vec![pack.clone()]), Some(pack));
    }

    // Anything that is not a live pack is not something to restore: an archive
    // was set aside on purpose, and the folder may hold whatever else the user
    // dropped in it.
    #[test]
    fn only_a_live_pack_is_restorable() {
        let files = vec![
            drive_file(
                "f1",
                "a1b2-archived-2024-05-04.rowel",
                "2024-01-01T00:00:00.000Z",
            ),
            drive_file("f2", "notes.txt", "2024-01-01T00:00:00.000Z"),
            drive_file("f3", "a1b2.rowelshare", "2024-01-01T00:00:00.000Z"),
        ];
        assert_eq!(oldest_live_pack(files), None);
        assert_eq!(oldest_live_pack(Vec::new()), None);
    }

    // Not expected while sync is primary-workspace-only, but whichever pack the
    // account had first is the answer every device would give.
    #[test]
    fn the_oldest_live_pack_wins_whatever_order_drive_lists_in() {
        let files = vec![
            drive_file("f2", "beef.rowel", "2024-06-01T00:00:00.000Z"),
            drive_file("f1", "a1b2.rowel", "2024-01-01T00:00:00.000Z"),
            drive_file("f3", "cafe.rowel", "2024-03-01T00:00:00.000Z"),
        ];
        assert_eq!(oldest_live_pack(files).unwrap().id, "f1");
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
        let mut file = drive_file("f1", "a1b2.rowel", "2024-01-01T00:00:00.000Z");
        file.modified_time = "2024-05-04T10:11:12.000Z".into();
        file.size = Some(2048);

        let info = PackInfo::from(&file);
        assert_eq!(info.name, "a1b2.rowel");
        assert_eq!(info.size, 2048);
        assert_eq!(info.modified_time, "2024-05-04T10:11:12.000Z");

        // Payload keys are the frontend's contract.
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["name"], "a1b2.rowel");
        assert_eq!(json["size"], 2048);
        assert_eq!(json["modifiedTime"], "2024-05-04T10:11:12.000Z");
    }

    // A `size` Drive did not report reads as 0 rather than breaking the shape
    // the frontend destructures.
    #[test]
    fn a_pack_of_unknown_size_reports_zero() {
        let file = drive_file("f1", "a1b2.rowel", "");
        assert_eq!(PackInfo::from(&file).size, 0);
    }
}
