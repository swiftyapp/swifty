//! The shape of Rowel's footprint in a Google Drive account.
//!
//! ```text
//! Rowel/
//!   Vaults/
//!     <vault-id>.rowel                 one live pack per vault
//!     <vault-id>-archived-<date>.rowel a pack set aside by "start fresh"
//!   Shares/
//!     <random>.rowelshare              one outstanding share
//! ```
//!
//! Every folder name, file name and extension Drive ever sees is minted here,
//! so the sync engine, first-run onboarding and sharing cannot drift apart —
//! and so the local `.rowel` backup and the pack on Drive, which are the same
//! bytes, carry the same extension.
//!
//! A vault is addressed by its *vault id*: the identity of the data, stored in
//! the encrypted `meta` table (see [`crate::store::identity`]) and carried
//! inside every pack. It is deliberately not the local workspace id, which is
//! `default` on every install and cannot tell two devices' primaries apart.
//! The folder shows the opaque id and never the user's label for the vault.
//!
//! Pure: names in, names out. Nothing here talks to Drive.

/// The one folder Rowel owns in the account.
pub const ROOT_FOLDER: &str = "Rowel";
/// Subfolder of [`ROOT_FOLDER`] holding one pack per vault.
pub const VAULTS_FOLDER: &str = "Vaults";
/// Subfolder of [`ROOT_FOLDER`] holding outstanding shares.
pub const SHARES_FOLDER: &str = "Shares";

/// Extension of a vault pack — on Drive, and of the backup `export_vault`
/// writes. Also the desktop file association in `tauri.conf.json`; keep the
/// two in step.
pub const VAULT_EXTENSION: &str = "rowel";
/// Extension of a sealed share envelope.
pub const SHARE_EXTENSION: &str = "rowelshare";
/// MIME type a vault pack is uploaded under; the same one the desktop file
/// association declares.
pub const VAULT_MIME: &str = "application/vnd.rowel";

/// The live pack of the vault with this id: `<vault-id>.rowel`.
pub fn vault_file_name(vault_id: &str) -> String {
    format!("{vault_id}.{VAULT_EXTENSION}")
}

/// The vault id a file in [`VAULTS_FOLDER`] is the live pack of, if it is one.
///
/// Exact: `<id>.rowel` where `<id>` is non-empty lowercase hex. An archived
/// pack (`<id>-archived-<date>.rowel`) is not a live vault and reads as `None`,
/// which is what keeps "start fresh" from ever being mistaken for a second
/// vault.
pub fn vault_id_of(file_name: &str) -> Option<&str> {
    let id = file_name.strip_suffix(&format!(".{VAULT_EXTENSION}"))?;
    let is_hex = !id.is_empty()
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    is_hex.then_some(id)
}

/// The name a pack is set aside under when the user starts fresh on `date`
/// (`YYYY-MM-DD`, UTC): the original stem, `-archived-<date>`, and the vault
/// extension — so `<id>.rowel` archives as `<id>-archived-<date>.rowel`. Same
/// extension as a live pack, so the archive is still recognisably a Rowel vault
/// the user could restore from.
pub fn archived_file_name(file_name: &str, date: &str) -> String {
    let stem = file_name
        .rsplit_once('.')
        .map_or(file_name, |(stem, _)| stem);
    format!("{stem}-archived-{date}.{VAULT_EXTENSION}")
}

/// A share file's name: `token` is random and the name says nothing else —
/// Drive shows the owner a file list, so it carries no title.
pub fn share_file_name(token: &str) -> String {
    format!("{token}.{SHARE_EXTENSION}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_live_pack_is_named_for_its_vault() {
        assert_eq!(vault_file_name("a1b2c3"), "a1b2c3.rowel");
        assert_eq!(vault_id_of("a1b2c3.rowel"), Some("a1b2c3"));
    }

    #[test]
    fn only_an_exact_hex_stem_reads_as_a_live_vault() {
        assert_eq!(vault_id_of("a1b2c3-archived-2026-09-17.rowel"), None);
        assert_eq!(vault_id_of("notes.txt"), None);
        assert_eq!(vault_id_of(".rowel"), None);
        assert_eq!(vault_id_of("A1B2.rowel"), None);
        assert_eq!(vault_id_of("a1b2.rowelshare"), None);
        assert_eq!(vault_id_of("a1b2"), None);
    }

    #[test]
    fn an_archive_keeps_the_stem_and_takes_the_vault_extension() {
        assert_eq!(
            archived_file_name("a1b2.rowel", "2026-09-17"),
            "a1b2-archived-2026-09-17.rowel"
        );
        assert_eq!(
            archived_file_name("noext", "2026-09-17"),
            "noext-archived-2026-09-17.rowel"
        );
    }

    #[test]
    fn a_share_is_named_by_its_token_alone() {
        assert_eq!(share_file_name("deadbeef"), "deadbeef.rowelshare");
    }
}
