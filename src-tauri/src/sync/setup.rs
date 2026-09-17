//! What a *keyless* install can ask of a connected Drive account.
//!
//! During first-run onboarding there is no vault, so none of the usual entry
//! points apply: [`super::run`] needs a session cryptor to read the token file
//! with, and the token file itself cannot exist until a vault key does. The
//! three questions onboarding actually has — which vaults are up there, give me
//! this one's bytes, move this one aside — are answered here against [`drive`]
//! directly, with an access token the caller holds in memory.
//!
//! (Not to be confused with [`super::setup`], the desktop consent flow for an
//! install that already has a vault.)

use reqwest::Client;
use serde::Serialize;

use super::{drive, layout, pack};
use crate::error::{Error, Result};

/// A remote vault as the onboarding screen describes it — enough for the user
/// to recognise the account as theirs, and to choose between two, without
/// downloading a byte.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackInfo {
    /// The Drive file id. The frontend hands it back to name which of several
    /// vaults the user chose to restore or to archive.
    pub id: String,
    pub name: String,
    /// The vault this pack holds, from its file name — `None` for the legacy
    /// `vault.swsync`, which predates vaults having ids.
    pub vault_id: Option<String>,
    /// `0` when Drive reported no length. Onboarding only renders this, and a
    /// missing size is not worth a second shape in the payload.
    pub size: u64,
    /// RFC 3339 UTC, as Drive gives it; the frontend formats it.
    pub modified_time: String,
}

impl From<&drive::DriveFile> for PackInfo {
    fn from(file: &drive::DriveFile) -> Self {
        Self {
            id: file.id.clone(),
            name: file.name.clone(),
            vault_id: layout::vault_id_of(&file.name).map(str::to_owned),
            size: file.size.unwrap_or(0),
            modified_time: file.modified_time.clone(),
        }
    }
}

/// Every vault in the account a first run could restore from, newest first.
///
/// An empty list covers "no Rowel folder", "no Vaults/ in it" and "a Vaults/
/// with nothing restorable in it" — to onboarding they are the same answer, and
/// the same fresh start.
///
/// All of them rather than one: two installs syncing their own primary vault to
/// the same Google account each mint their own vault id, so the account holds a
/// pack per vault. Picking one here would hide the rest, and restore or "start
/// fresh" would then act on a vault the user never chose.
pub async fn find_packs(client: &Client, token: &str) -> Result<Vec<PackInfo>> {
    let Some(root) = drive::folder_id(client, token, layout::ROOT_FOLDER).await? else {
        return Ok(Vec::new());
    };
    let vaults = match drive::folder_id_in(client, token, layout::VAULTS_FOLDER, &root).await? {
        Some(vaults) => drive::list_folder(client, token, &vaults).await?,
        None => Vec::new(),
    };
    // The pre-`Vaults/` location is read too, for an account nobody has synced
    // since the upgrade: its pack still sits directly in `Rowel/` under the old
    // name, and a first run that could not see it would offer to start fresh
    // over a vault the user very much still has. The sync engine moves the file
    // into place on its next run, so this goes with the rest of the legacy
    // layout in a later cleanup.
    let legacy = drive::find_file(client, token, layout::LEGACY_VAULT_FILE, &root).await?;
    Ok(restorable_packs(vaults, legacy))
}

/// The pack with this Drive file id, re-listed rather than trusted from the
/// probe: the two are minutes apart, and a stale id is a confusing failure
/// where "no vault up there any more" is a clear one.
pub async fn find_pack_by_id(client: &Client, token: &str, file_id: &str) -> Result<PackInfo> {
    find_packs(client, token)
        .await?
        .into_iter()
        .find(|pack| pack.id == file_id)
        .ok_or(Error::NoRemoteVault)
}

/// Which of `vaults` (the contents of `Rowel/Vaults/`) and the legacy
/// `Rowel/vault.swsync` are vaults to offer, and in what order.
///
/// Live packs only: an archived pack is a vault the user deliberately set
/// aside, and [`layout::vault_id_of`] is what tells the two apart. The legacy
/// file counts only while it is still a real pack — once an upgraded device has
/// migrated it, the same name holds a tombstone carrying
/// [`layout::PROP_MOVED_TO`], which is a signpost to a pack already listed
/// above and not a vault of its own.
///
/// Newest first, because that is the order a picker wants: `modified_time` is
/// RFC 3339 UTC, a fixed-width format whose lexicographic order *is*
/// chronological order, and the file id settles ties so every device shows the
/// same list.
fn restorable_packs(
    vaults: Vec<drive::DriveFile>,
    legacy: Option<drive::DriveFile>,
) -> Vec<PackInfo> {
    let mut packs: Vec<PackInfo> = vaults
        .iter()
        .filter(|file| layout::vault_id_of(&file.name).is_some())
        .chain(legacy.iter().filter(|file| !is_tombstone(file)))
        .map(PackInfo::from)
        .collect();
    packs.sort_by(|a, b| {
        b.modified_time
            .cmp(&a.modified_time)
            .then_with(|| a.id.cmp(&b.id))
    });
    packs
}

/// Whether the file at [`layout::LEGACY_VAULT_FILE`] is the marker left behind
/// by a migration rather than a pack. The listing alone answers it — the
/// appProperty is there precisely so nobody has to download the bytes.
fn is_tombstone(file: &drive::DriveFile) -> bool {
    file.app_properties.contains_key(layout::PROP_MOVED_TO)
}

/// Download a pack located by [`find_packs`], under the same size cap the sync
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
/// The whole pack, not just its id, because the archived name is built from the
/// name it already has: a pack keeps its vault id, and the legacy file keeps
/// its stem. Same-day collisions are fine — Drive allows same-name siblings, so
/// a second archive on one day sits beside the first rather than replacing it.
pub async fn archive_pack(
    client: &Client,
    token: &str,
    file: &PackInfo,
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

    // `modified_time` doubles as the created stamp: nothing here reads the
    // latter, and the listing is ordered by the former.
    fn drive_file(id: &str, name: &str, modified: &str) -> drive::DriveFile {
        drive::DriveFile {
            id: id.into(),
            name: name.into(),
            created_time: modified.into(),
            modified_time: modified.into(),
            size: None,
            head_revision: None,
            app_properties: Default::default(),
        }
    }

    // The legacy file once an upgraded device has moved the pack into `Vaults/`.
    fn tombstone(id: &str, moved_to: &str) -> drive::DriveFile {
        let mut file = drive_file(id, layout::LEGACY_VAULT_FILE, "2024-06-01T00:00:00.000Z");
        file.app_properties
            .insert(layout::PROP_MOVED_TO.into(), moved_to.into());
        file
    }

    fn ids(packs: &[PackInfo]) -> Vec<&str> {
        packs.iter().map(|pack| pack.id.as_str()).collect()
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

    // One vault in the account is the ordinary case.
    #[test]
    fn the_single_live_pack_is_the_one_to_restore() {
        let pack = drive_file("f1", "a1b2.rowel", "2024-01-01T00:00:00.000Z");
        let packs = restorable_packs(vec![pack], None);
        assert_eq!(ids(&packs), ["f1"]);
        assert_eq!(packs[0].vault_id.as_deref(), Some("a1b2"));
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
        assert!(restorable_packs(files, None).is_empty());
        assert!(restorable_packs(Vec::new(), None).is_empty());
    }

    // Every vault the account holds, so the user picks rather than having one
    // picked for them — newest first, whatever order Drive listed them in.
    #[test]
    fn every_live_pack_is_offered_newest_first() {
        let files = vec![
            drive_file("f2", "beef.rowel", "2024-06-01T00:00:00.000Z"),
            drive_file("f1", "a1b2.rowel", "2024-01-01T00:00:00.000Z"),
            drive_file("f3", "cafe.rowel", "2024-03-01T00:00:00.000Z"),
        ];
        assert_eq!(ids(&restorable_packs(files, None)), ["f2", "f3", "f1"]);
    }

    // Two packs written in the same second still list in one fixed order, so
    // every device shows the same thing and a chosen id means the same vault.
    #[test]
    fn packs_of_the_same_age_are_ordered_by_file_id() {
        let files = vec![
            drive_file("f2", "beef.rowel", "2024-06-01T00:00:00.000Z"),
            drive_file("f1", "a1b2.rowel", "2024-06-01T00:00:00.000Z"),
        ];
        assert_eq!(ids(&restorable_packs(files, None)), ["f1", "f2"]);
    }

    // An account nobody has synced since the upgrade holds its only vault at
    // the legacy name — it is offered alongside the rest, with no vault id of
    // its own because the name carries none.
    #[test]
    fn the_legacy_pack_is_a_vault_until_it_is_migrated() {
        let legacy = drive_file("old", layout::LEGACY_VAULT_FILE, "2024-06-01T00:00:00.000Z");
        let packs = restorable_packs(Vec::new(), Some(legacy));
        assert_eq!(ids(&packs), ["old"]);
        assert_eq!(packs[0].vault_id, None);
        assert_eq!(packs[0].name, layout::LEGACY_VAULT_FILE);
    }

    // Once the pack has moved into `Vaults/`, the old name holds a signpost to
    // it. Listing that as a vault would offer the same data twice — and the
    // second copy would not open, because a tombstone is not a pack.
    #[test]
    fn a_tombstone_at_the_legacy_name_is_not_a_vault() {
        let moved = drive_file("f1", "a1b2.rowel", "2024-01-01T00:00:00.000Z");
        let packs = restorable_packs(vec![moved], Some(tombstone("old", "a1b2")));
        assert_eq!(ids(&packs), ["f1"]);
        assert!(restorable_packs(Vec::new(), Some(tombstone("old", "a1b2"))).is_empty());
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
        let mut file = drive_file("f1", "a1b2.rowel", "2024-05-04T10:11:12.000Z");
        file.size = Some(2048);

        let info = PackInfo::from(&file);
        assert_eq!(info.id, "f1");
        assert_eq!(info.name, "a1b2.rowel");
        assert_eq!(info.vault_id.as_deref(), Some("a1b2"));
        assert_eq!(info.size, 2048);
        assert_eq!(info.modified_time, "2024-05-04T10:11:12.000Z");

        // Payload keys are the frontend's contract.
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["id"], "f1");
        assert_eq!(json["name"], "a1b2.rowel");
        assert_eq!(json["vaultId"], "a1b2");
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
