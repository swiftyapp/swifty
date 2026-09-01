use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use super::{migrate, Record, SqliteStore, StoreError, VaultStore};
use crate::crypto::{self, KdfParams, VaultKey};
use crate::models::Entry;

const KEY: &[u8] = &[0x11; 32];

// Low-cost Argon2id params keep the key-schedule tests fast; production uses the
// 64 MiB defaults.
fn argon2_params(salt: &[u8]) -> KdfParams {
    KdfParams::argon2id(salt, 256, 1, 1)
}

fn argon2_key(password: &str, params: &KdfParams) -> VaultKey {
    VaultKey::Argon2 {
        master: crypto::derive(password.as_bytes(), params).unwrap(),
    }
}

fn sample_entry() -> Entry {
    serde_json::from_value(serde_json::json!({
        "id": "1", "type": "login", "title": "Site",
        "website": "https://ex.com/login", "username": "alice",
        "password": "s3cret", "tags": ["work"]
    }))
    .unwrap()
}

// A fresh, unique DB path under the temp dir for each test.
fn tmp_db() -> PathBuf {
    static N: AtomicU64 = AtomicU64::new(0);
    let dir = std::env::temp_dir().join(format!(
        "swifty-store-{}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir.join("vault.db")
}

fn rec(id: &str, payload: &[u8]) -> Record {
    Record {
        id: id.into(),
        kind: "login".into(),
        title: "Example".into(),
        tags: "[\"a\",\"b\"]".into(),
        url_host: "example.com".into(),
        created_at: 0,
        updated_at: 0,
        deleted_at: None,
        payload: payload.to_vec(),
        card_brand: None,
    }
}

#[test]
fn crud_round_trip() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    store.upsert(&rec("1", b"secret-blob")).unwrap();

    let got = store.get("1").unwrap().unwrap();
    assert_eq!(got.id, "1");
    assert_eq!(got.title, "Example");
    assert_eq!(store.list().unwrap().len(), 1);
    assert_eq!(store.get("missing").unwrap(), None);
}

#[test]
fn payload_is_byte_identical() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    // Arbitrary non-utf8 bytes: the store must never interpret the payload.
    let blob: Vec<u8> = (0u16..=255).map(|b| b as u8).collect();
    store.upsert(&rec("1", &blob)).unwrap();
    assert_eq!(store.get("1").unwrap().unwrap().payload, blob);
}

#[test]
fn delete_tombstones_and_hides_from_list() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    store.upsert(&rec("1", b"x")).unwrap();
    store.delete("1").unwrap();

    assert!(store.list().unwrap().is_empty());
    assert_eq!(store.get("1").unwrap(), None);

    let exported = store.export_for_sync().unwrap();
    assert_eq!(exported.len(), 1);
    assert!(exported[0].deleted_at.is_some());
}

#[test]
fn upsert_stamps_updated_at() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    // Seed via import so the low timestamp is preserved, then upsert to bump it.
    let mut r = rec("1", b"x");
    r.updated_at = 1000;
    store.import(&[r]).unwrap();

    store.upsert(&rec("1", b"y")).unwrap();
    assert!(store.get("1").unwrap().unwrap().updated_at > 1000);
}

#[test]
fn import_preserves_timestamps() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    let mut r = rec("1", b"x");
    r.created_at = 111;
    r.updated_at = 222;
    store.import(&[r]).unwrap();

    let got = &store.export_for_sync().unwrap()[0];
    assert_eq!(got.created_at, 111);
    assert_eq!(got.updated_at, 222);
}

#[test]
fn meta_get_set() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    assert_eq!(store.meta_get("kdf").unwrap(), None);
    store.meta_set("kdf", "argon2id").unwrap();
    assert_eq!(store.meta_get("kdf").unwrap().as_deref(), Some("argon2id"));
    // Schema DDL versioning lives in `user_version`, not the app `meta` table.
    assert_eq!(store.meta_get("schema_version").unwrap(), None);
}

#[test]
fn wrong_key_fails() {
    let path = tmp_db();
    SqliteStore::open(&path, KEY)
        .unwrap()
        .upsert(&rec("1", b"x"))
        .unwrap();
    assert!(SqliteStore::open(&path, &[0x22; 32]).is_err());
}

#[test]
fn reopen_after_commit_persists() {
    let path = tmp_db();
    {
        let store = SqliteStore::open(&path, KEY).unwrap();
        store.upsert(&rec("1", b"durable")).unwrap();
    }
    let store = SqliteStore::open(&path, KEY).unwrap();
    assert_eq!(store.get("1").unwrap().unwrap().payload, b"durable");
}

#[cfg(unix)]
#[test]
fn file_mode_is_0600() {
    use std::os::unix::fs::PermissionsExt;
    let path = tmp_db();
    SqliteStore::open(&path, KEY).unwrap();
    let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode, 0o600);
}

#[test]
fn snapshot_is_encrypted_and_reopens() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    store.upsert(&rec("1", b"durable")).unwrap();

    let snap = tmp_db().with_file_name("snapshot.db");
    store.snapshot_to(&snap, KEY).unwrap();

    // The snapshot reopens with the same key and carries the committed row.
    let restored = SqliteStore::open(&snap, KEY).unwrap();
    assert_eq!(restored.get("1").unwrap().unwrap().payload, b"durable");
    // It is genuinely encrypted: a wrong key cannot open it.
    assert!(SqliteStore::open(&snap, &[0x22; 32]).is_err());
}

#[test]
fn rekey_reencrypts_db_in_place() {
    let path = tmp_db();
    let store = SqliteStore::open(&path, KEY).unwrap();
    store.upsert(&rec("1", b"durable")).unwrap();

    const KEY2: &[u8] = &[0x22; 32];
    store.rekey(KEY2).unwrap();
    // The live handle keeps working after rekey.
    assert_eq!(store.get("1").unwrap().unwrap().payload, b"durable");
    drop(store);

    // Reopening requires the new key; the old key no longer opens it.
    assert!(SqliteStore::open(&path, KEY).is_err());
    let store = SqliteStore::open(&path, KEY2).unwrap();
    assert_eq!(store.get("1").unwrap().unwrap().payload, b"durable");
}

// The one open failure that must NOT read as a wrong key: a vault stamped by
// a newer build (user_version above this binary's migration list).
#[test]
fn future_schema_fails_as_schema_newer_not_wrong_key() {
    let path = tmp_db();
    {
        let store = SqliteStore::open(&path, KEY).unwrap();
        store.set_user_version(99).unwrap();
    }
    match SqliteStore::open(&path, KEY) {
        Err(StoreError::SchemaNewer) => {}
        Err(other) => panic!("expected SchemaNewer, got error: {other}"),
        Ok(_) => panic!("expected SchemaNewer, but the open succeeded"),
    }
}

#[test]
fn reopening_a_migrated_db_is_idempotent() {
    let path = tmp_db();
    {
        let store = SqliteStore::open(&path, KEY).unwrap();
        store.upsert(&rec("1", b"x")).unwrap();
    }
    // Opening an already-at-latest DB re-runs no migration and does not error.
    let store = SqliteStore::open(&path, KEY).unwrap();
    assert_eq!(store.list().unwrap().len(), 1);
    // schema DDL versioning lives in user_version, not the app `meta` table.
    assert_eq!(store.meta_get("schema_version").unwrap(), None);
}

// save_entry then reveal_entry, exercised through the Argon2id key schedule:
// seal a plaintext entry under the payload key, upsert one row, unseal it back.
#[test]
fn save_then_reveal_round_trips_one_row() {
    let key = argon2_key("pw", &argon2_params(b"salt-a-01234567890123456789012345"));
    let cipher = key.payload_cipher();
    let store = SqliteStore::open(&tmp_db(), &key.sqlcipher_key()).unwrap();

    let entry = sample_entry();
    let payload = cipher.seal(&entry).unwrap();
    let record = migrate::build_record(&entry, payload).unwrap();
    store.upsert(&record).unwrap();
    // Saving the same id again updates the single row (no whole-vault rewrite).
    store.upsert(&record).unwrap();

    let list = store.list().unwrap();
    assert_eq!(list.len(), 1);
    // The list carries only non-secret metadata — the password never appears.
    assert_eq!(list[0].url_host, "ex.com");
    let meta_json = serde_json::to_string(&(
        &list[0].title,
        &list[0].tags,
        &list[0].url_host,
        &list[0].kind,
    ))
    .unwrap();
    assert!(!meta_json.contains("s3cret"));

    // reveal_entry: unseal the stored payload with the session payload key.
    let rec = store.get("1").unwrap().unwrap();
    let revealed = cipher.unseal(&rec.payload).unwrap();
    assert_eq!(revealed.password.as_deref(), Some("s3cret"));
    assert_eq!(revealed.username.as_deref(), Some("alice"));
}

// Setup writes an Argon2id descriptor; unlock re-derives from that (serialized)
// descriptor and opens the same DB. A wrong password derives a different key and
// the open fails.
#[test]
fn argon2_descriptor_reproduces_key_and_opens() {
    let path = tmp_db();
    let params = argon2_params(b"salt-b-01234567890123456789012345");

    // setup: derive, open, save a sealed entry.
    let key = argon2_key("master-pw", &params);
    {
        let store = SqliteStore::open(&path, &key.sqlcipher_key()).unwrap();
        let cipher = key.payload_cipher();
        let payload = cipher.seal(&sample_entry()).unwrap();
        store
            .upsert(&migrate::build_record(&sample_entry(), payload).unwrap())
            .unwrap();
    }

    // The persisted descriptor is Argon2id and round-trips through JSON (sidecar).
    let sidecar = params.to_json().unwrap();
    assert!(sidecar.contains("\"algo\":\"argon2id\""));
    let reloaded = KdfParams::from_json(&sidecar).unwrap();

    // unlock: re-derive from the reloaded descriptor and reopen.
    let key2 = argon2_key("master-pw", &reloaded);
    let store2 = SqliteStore::open(&path, &key2.sqlcipher_key()).unwrap();
    let revealed = key2
        .payload_cipher()
        .unseal(&store2.get("1").unwrap().unwrap().payload)
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("s3cret"));

    // A wrong password derives a different SQLCipher key → open fails.
    let wrong = argon2_key("wrong-pw", &reloaded);
    assert!(SqliteStore::open(&path, &wrong.sqlcipher_key()).is_err());
}

// Back-compat: a DB created with the legacy deterministic key (no sidecar) still
// opens via the legacy `VaultKey` fallback, and its payloads unseal.
#[test]
fn legacy_sidecarless_vault_opens() {
    let path = tmp_db();
    let key = VaultKey::legacy_from_password("master-pw");
    {
        let store = SqliteStore::open(&path, &key.sqlcipher_key()).unwrap();
        let payload = key.payload_cipher().seal(&sample_entry()).unwrap();
        store
            .upsert(&migrate::build_record(&sample_entry(), payload).unwrap())
            .unwrap();
    }

    let key2 = VaultKey::legacy_from_password("master-pw");
    let store2 = SqliteStore::open(&path, &key2.sqlcipher_key()).unwrap();
    let revealed = key2
        .payload_cipher()
        .unseal(&store2.get("1").unwrap().unwrap().payload)
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("s3cret"));
}

// change_master_password: re-seal every payload under the new payload key, rekey
// the DB to the new SQLCipher key, and write a fresh descriptor. The new
// descriptor + new password opens and reveals; the old key no longer opens.
#[test]
fn change_password_reseals_rekeys_and_new_descriptor_opens() {
    let path = tmp_db();
    let old = argon2_key(
        "old-pw",
        &argon2_params(b"salt-c-01234567890123456789012345"),
    );
    let store = SqliteStore::open(&path, &old.sqlcipher_key()).unwrap();
    let payload = old.payload_cipher().seal(&sample_entry()).unwrap();
    store
        .upsert(&migrate::build_record(&sample_entry(), payload).unwrap())
        .unwrap();

    // Fresh Argon2id params (new salt) → new key; re-seal old→new, import, rekey.
    let new_params = argon2_params(b"salt-d-01234567890123456789012345");
    let new = argon2_key("new-pw", &new_params);
    let (old_cipher, new_cipher) = (old.payload_cipher(), new.payload_cipher());
    let resealed: Vec<Record> = store
        .export_for_sync()
        .unwrap()
        .into_iter()
        .map(|mut r| {
            let entry = old_cipher.unseal(&r.payload).unwrap();
            r.payload = new_cipher.seal(&entry).unwrap();
            r
        })
        .collect();
    store.import(&resealed).unwrap();
    store.rekey(&new.sqlcipher_key()).unwrap();
    drop(store);

    // The old key no longer opens; the new descriptor + password does.
    assert!(SqliteStore::open(&path, &old.sqlcipher_key()).is_err());
    let reopened = argon2_key(
        "new-pw",
        &KdfParams::from_json(&new_params.to_json().unwrap()).unwrap(),
    );
    let store2 = SqliteStore::open(&path, &reopened.sqlcipher_key()).unwrap();
    let revealed = reopened
        .payload_cipher()
        .unseal(&store2.get("1").unwrap().unwrap().payload)
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("s3cret"));
}

// Crash-recovery composition for change_master_password: snapshot the old-keyed
// DB, then re-key it (simulating a change that then "crashes"), then restore the
// snapshot back over the DB. The recovered DB must open under the OLD key with the
// original payload intact — proving the snapshot is a valid rollback point.
#[test]
fn snapshot_then_rekey_then_restore_recovers_old_key() {
    let path = tmp_db();
    let backup = path.with_file_name("vault.db.rekey-backup");
    let old = argon2_key(
        "old-pw",
        &argon2_params(b"salt-f-01234567890123456789012345"),
    );

    {
        let store = SqliteStore::open(&path, &old.sqlcipher_key()).unwrap();
        let payload = old.payload_cipher().seal(&sample_entry()).unwrap();
        store
            .upsert(&migrate::build_record(&sample_entry(), payload).unwrap())
            .unwrap();
        // Recovery point, then the destructive rekey.
        store.snapshot_to(&backup, &old.sqlcipher_key()).unwrap();
        let new = argon2_key(
            "new-pw",
            &argon2_params(b"salt-g-01234567890123456789012345"),
        );
        store.rekey(&new.sqlcipher_key()).unwrap();
    } // connection closed

    // "Crash" rollback: drop stale WAL/SHM, copy the snapshot back over the DB.
    for suffix in ["-wal", "-shm"] {
        let mut p = path.clone().into_os_string();
        p.push(suffix);
        let _ = std::fs::remove_file(PathBuf::from(p));
    }
    std::fs::copy(&backup, &path).unwrap();

    // The restored DB opens with the OLD key and the payload is intact.
    let store = SqliteStore::open(&path, &old.sqlcipher_key()).unwrap();
    let revealed = old
        .payload_cipher()
        .unseal(&store.get("1").unwrap().unwrap().payload)
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("s3cret"));
}

// import_swftx re-seals a `.swftx` encrypted under a *different* master password
// into the open store: expose under the source key, re-seal under the current
// payload key, upsert. Reveal with the current key must return the original
// plaintext, and importing twice must merge by id (no duplicate rows).
#[test]
fn import_swftx_reseals_across_passwords_and_upserts_by_id() {
    use crate::crypto::{hash_secret, Cryptor};
    use crate::models::VaultData;

    let src = Cryptor::new(&hash_secret("source-pw"));
    let plain: Vec<Entry> = ["1", "2"]
        .iter()
        .map(|id| {
            serde_json::from_value(serde_json::json!({
                "id": id, "type": "login", "title": format!("Site {id}"),
                "website": "https://example.com/login", "username": "alice",
                "password": "hunter2", "tags": ["work"]
            }))
            .unwrap()
        })
        .collect();

    // The source `.swftx`: entries obscured and sealed under the source password.
    let blob = src
        .encrypt_data(&VaultData {
            entries: plain.iter().map(|e| src.obscure(e).unwrap()).collect(),
        })
        .unwrap();

    // Decrypt with the source cryptor (as the command does), then re-seal each
    // entry under the current session's Argon2id payload key.
    let file: VaultData = src.decrypt_data(&blob).unwrap();
    let key = argon2_key(
        "current-pw",
        &argon2_params(b"salt-e-01234567890123456789012345"),
    );
    let cipher = key.payload_cipher();
    let store = SqliteStore::open(&tmp_db(), &key.sqlcipher_key()).unwrap();
    for r in migrate::reseal_swftx(&file.entries, &src, &cipher).unwrap() {
        store.upsert(&r).unwrap();
    }
    // Re-importing the same file merges by id — the count stays at 2.
    for r in migrate::reseal_swftx(&file.entries, &src, &cipher).unwrap() {
        store.upsert(&r).unwrap();
    }
    assert_eq!(store.list().unwrap().len(), 2);

    // Reveal with the current payload key returns the original plaintext secrets.
    let revealed = cipher
        .unseal(&store.get("1").unwrap().unwrap().payload)
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("hunter2"));
    assert_eq!(revealed.username.as_deref(), Some("alice"));
}

// A wrong source password fails the file decrypt before the store is touched.
#[test]
fn import_swftx_wrong_source_password_errors() {
    use crate::crypto::{hash_secret, Cryptor};
    use crate::models::VaultData;

    let src = Cryptor::new(&hash_secret("source-pw"));
    let entry: Entry = serde_json::from_value(serde_json::json!({
        "id": "1", "type": "login", "title": "Site", "password": "hunter2"
    }))
    .unwrap();
    let blob = src
        .encrypt_data(&VaultData {
            entries: vec![src.obscure(&entry).unwrap()],
        })
        .unwrap();

    let wrong = Cryptor::new(&hash_secret("not-the-password"));
    assert!(wrong.decrypt_data::<VaultData>(&blob).is_err());
}
