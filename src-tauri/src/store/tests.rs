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
    // schema_version is stamped on open.
    assert_eq!(
        store.meta_get("schema_version").unwrap().as_deref(),
        Some("1")
    );
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
