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
}
