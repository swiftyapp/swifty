use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use super::migrate::migrate_from_json;
use super::{Record, SqliteStore, VaultStore};

const KEY: &[u8] = &[0x11; 32];

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

#[test]
fn save_then_reveal_round_trips_one_row() {
    use super::migrate::records_from_entries;
    use crate::crypto::Cryptor;
    use crate::models::Entry;

    let cryptor = Cryptor::new(&crate::crypto::hash_secret("pw"));
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();

    // save_entry: obscure the plaintext entry, seal it into one payload, upsert.
    let plain: Entry = serde_json::from_value(serde_json::json!({
        "id": "1", "type": "login", "title": "Site",
        "website": "https://ex.com/login", "username": "alice",
        "password": "s3cret", "tags": ["work"]
    }))
    .unwrap();
    let obscured = cryptor.obscure(&plain).unwrap();
    let recs = records_from_entries(&[obscured], &cryptor).unwrap();
    store.upsert(&recs[0]).unwrap();

    // Saving the same id again updates the single row (no whole-vault rewrite).
    store.upsert(&recs[0]).unwrap();
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

    // reveal_entry: unseal the payload, then decrypt the per-field secrets.
    let rec = store.get("1").unwrap().unwrap();
    let blob = String::from_utf8(rec.payload).unwrap();
    let revealed = cryptor
        .expose(&cryptor.decrypt_data::<Entry>(&blob).unwrap())
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("s3cret"));
    assert_eq!(revealed.username.as_deref(), Some("alice"));
}

// import_swftx re-keys a `.swftx` encrypted under a *different* master password
// into the open store: expose under the source key, re-obscure under the current
// key, upsert. Reveal with the current key must return the original plaintext,
// and importing twice must merge by id (no duplicate rows).
#[test]
fn import_swftx_rekeys_across_passwords_and_upserts_by_id() {
    use super::migrate::rekey_record;
    use crate::crypto::{hash_secret, Cryptor};
    use crate::models::{Entry, VaultData};

    let src = Cryptor::new(&hash_secret("source-pw"));
    let cur = Cryptor::new(&hash_secret("current-pw"));

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

    // Decrypt the file with the source cryptor (as the command does), then re-key
    // each entry into a store opened for the *current* session.
    let file: VaultData = src.decrypt_data(&blob).unwrap();
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    for obscured in &file.entries {
        store
            .upsert(&rekey_record(&src, &cur, obscured).unwrap())
            .unwrap();
    }

    // Re-importing the same file merges by id — the count stays at 2.
    for obscured in &file.entries {
        store
            .upsert(&rekey_record(&src, &cur, obscured).unwrap())
            .unwrap();
    }
    let list = store.list().unwrap();
    assert_eq!(list.len(), 2);

    // Reveal with the *current* key returns the original plaintext secrets.
    let rec = store.get("1").unwrap().unwrap();
    let payload = String::from_utf8(rec.payload).unwrap();
    let revealed = cur
        .expose(&cur.decrypt_data::<Entry>(&payload).unwrap())
        .unwrap();
    assert_eq!(revealed.password.as_deref(), Some("hunter2"));
    assert_eq!(revealed.username.as_deref(), Some("alice"));
}

// A wrong source password fails the file decrypt before the store is touched.
#[test]
fn import_swftx_wrong_source_password_errors() {
    use crate::crypto::{hash_secret, Cryptor};
    use crate::models::{Entry, VaultData};

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

#[test]
fn migrate_from_json_round_trips_and_keeps_bak() {
    use crate::crypto::Cryptor;
    use crate::models::{Entry, VaultData};

    let cryptor = Cryptor::new(&crate::crypto::hash_secret("master-pw"));
    let entries: Vec<Entry> = ["1", "2"]
        .iter()
        .map(|id| {
            serde_json::from_value(serde_json::json!({
                "id": id, "type": "login", "title": format!("Site {id}"),
                "website": "https://example.com/login", "password": "hunter2",
                "tags": ["work"], "createdAt": "2024-01-02T03:04:05Z"
            }))
            .unwrap()
        })
        .collect();
    let obscured: Vec<Entry> = entries
        .iter()
        .map(|e| cryptor.obscure(e).unwrap())
        .collect();
    let blob = cryptor
        .encrypt_data(&VaultData {
            entries: obscured.clone(),
        })
        .unwrap();

    let json_path = tmp_db().with_file_name("vault.swftx");
    std::fs::write(&json_path, &blob).unwrap();

    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    let n = migrate_from_json(&json_path, &cryptor, &store).unwrap();
    assert_eq!(n, 2);

    // Metadata landed in columns.
    let list = store.list().unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].url_host, "example.com");

    // Payload decrypts back to the identical (obscured) entries.
    for (want, meta) in obscured.iter().zip(&list) {
        let record = store.get(&meta.id).unwrap().unwrap();
        let payload = String::from_utf8(record.payload).unwrap();
        let got: Entry = cryptor.decrypt_data(&payload).unwrap();
        assert_eq!(
            serde_json::to_value(&got).unwrap(),
            serde_json::to_value(want).unwrap()
        );
    }

    // The legacy JSON is retained as a .bak sidecar.
    let mut bak = json_path.into_os_string();
    bak.push(".bak");
    assert!(PathBuf::from(bak).exists());
}
