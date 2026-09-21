//! The vault id: a stable identity for a vault's *data*.
//!
//! Minted once when a vault is created and kept in the encrypted `meta` table,
//! so it travels inside every pack and backup: a `.rowel` restored on another
//! device is the same vault, and Drive sync finds its pack under the same name
//! (see `sync::layout`). It is not the workspace id — that is a local slot,
//! `default` on every install — and it is not under `SYNC_META_PREFIX`, so a
//! restore keeps it while scrubbing the source device's sync bookkeeping.
//!
//! Vaults created before ids existed have none; sync assigns one the first
//! time it needs it (or adopts the one the remote already carries).
//!
//! The vault's *name* lives here for the same reason: a label kept only in this
//! device's workspace registry is a label the user's other devices never see.
//! It carries a stamp because two devices can rename the same vault, and the
//! later rename has to win (see `sync::engine`).
//!
//! Like `migrate`, this reaches for the app's crypto to mint ids; it is a
//! boundary helper, not part of the pure [`VaultStore`] trait.

use super::{Result, VaultStore};

/// `meta` key the id is stored under.
pub const META_VAULT_ID: &str = "vault_id";

/// The vault's id, or `None` for a vault created before ids existed.
pub fn vault_id(store: &impl VaultStore) -> Result<Option<String>> {
    Ok(store.meta_get(META_VAULT_ID)?.filter(|id| !id.is_empty()))
}

/// Give the vault a fresh id, replacing any it had. For creation, and for the
/// one upgrade case where no remote exists to adopt from.
pub fn assign_vault_id(store: &impl VaultStore) -> Result<String> {
    let id = crate::crypto::random_hex_id();
    store.meta_set(META_VAULT_ID, &id)?;
    Ok(id)
}

/// Take on an id that already names this vault elsewhere — the remote pack an
/// upgraded install found under `Vaults/`.
pub fn adopt_vault_id(store: &impl VaultStore, id: &str) -> Result<()> {
    store.meta_set(META_VAULT_ID, id)
}

/// `meta` keys the vault's name is stored under: the label, and the ms-epoch
/// stamp it was last set at.
pub const META_VAULT_NAME: &str = "vault_name";
pub const META_VAULT_NAME_MS: &str = "vault_name_updated_ms";

/// The vault's name and when it was set. A vault nobody has named reads as
/// `(None, 0)`, which loses to every stamped name there is.
pub fn vault_name(store: &impl VaultStore) -> Result<(Option<String>, i64)> {
    let name = store
        .meta_get(META_VAULT_NAME)?
        .filter(|name| !name.is_empty());
    let at_ms = store
        .meta_get(META_VAULT_NAME_MS)?
        .and_then(|ms| ms.parse().ok())
        .unwrap_or(0);
    Ok((name, at_ms))
}

/// Name the vault, stamping when. The stamp travels with the name so another
/// device can tell which of two renames came last.
pub fn set_vault_name(store: &impl VaultStore, name: &str, at_ms: i64) -> Result<()> {
    store.meta_set(META_VAULT_NAME, name)?;
    store.meta_set(META_VAULT_NAME_MS, &at_ms.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::SqliteStore;

    fn store() -> SqliteStore {
        static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "rowel-identity-{}-{}.db",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));
        SqliteStore::open(&path, &[7u8; 32]).unwrap()
    }

    #[test]
    fn a_new_store_has_no_id_until_one_is_assigned() {
        let store = store();
        assert_eq!(vault_id(&store).unwrap(), None);
        let id = assign_vault_id(&store).unwrap();
        assert_eq!(id.len(), 32);
        assert!(id.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_eq!(vault_id(&store).unwrap().as_deref(), Some(id.as_str()));
    }

    #[test]
    fn adopting_takes_the_given_id_verbatim() {
        let store = store();
        adopt_vault_id(&store, "a1b2").unwrap();
        assert_eq!(vault_id(&store).unwrap().as_deref(), Some("a1b2"));
    }

    #[test]
    fn an_empty_stored_id_reads_as_none() {
        let store = store();
        store.meta_set(META_VAULT_ID, "").unwrap();
        assert_eq!(vault_id(&store).unwrap(), None);
    }

    #[test]
    fn a_name_round_trips_with_the_stamp_it_was_set_at() {
        let store = store();
        assert_eq!(vault_name(&store).unwrap(), (None, 0));

        set_vault_name(&store, "Work", 1_700_000_000_000).unwrap();
        assert_eq!(
            vault_name(&store).unwrap(),
            (Some("Work".to_string()), 1_700_000_000_000)
        );
    }

    // A vault named before the stamp existed still reads, and reads as the
    // oldest name there is — so the first device to rename it wins.
    #[test]
    fn a_name_with_no_stamp_reads_as_stamped_zero() {
        let store = store();
        store.meta_set(META_VAULT_NAME, "Work").unwrap();
        assert_eq!(vault_name(&store).unwrap(), (Some("Work".to_string()), 0));
    }
}
