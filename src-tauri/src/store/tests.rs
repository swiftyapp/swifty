use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use super::{migrate, record_hash, Record, SqliteStore, StoreError, VaultStore, SYNC_META_PREFIX};
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

// A record with the timestamps merge actually reasons about. `created_at` is
// held constant so a differing `updated_at` is the only axis under test.
fn stamped(id: &str, payload: &[u8], updated_at: i64) -> Record {
    Record {
        created_at: 100,
        updated_at,
        ..rec(id, payload)
    }
}

fn tombstone(id: &str, at: i64) -> Record {
    Record {
        deleted_at: Some(at),
        ..stamped(id, b"", at)
    }
}

// Seed rows with their timestamps intact (import, unlike upsert, does not stamp)
// and clear the dirty flag the seeding itself sets.
fn seeded(recs: &[Record]) -> SqliteStore {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    store.import(recs).unwrap();
    store.clear_dirty().unwrap();
    store
}

fn row(store: &SqliteStore, id: &str) -> Record {
    store
        .export_for_sync()
        .unwrap()
        .into_iter()
        .find(|r| r.id == id)
        .unwrap()
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

// ---- sync merge primitives ------------------------------------------------

// The length prefixes exist so that shifting a byte across a field boundary is
// a different preimage; without them ("ab","c") and ("a","bc") would collide,
// and the merge tie-break would call two different records equal.
#[test]
fn record_hash_separates_adjacent_fields() {
    let mut a = rec("1", b"x");
    a.title = "ab".into();
    a.tags = "c".into();
    let mut b = a.clone();
    b.title = "a".into();
    b.tags = "bc".into();

    assert_ne!(record_hash(&a), record_hash(&b));
    // Same content, same hash — the id is deliberately not part of it.
    assert_eq!(record_hash(&a), record_hash(&a.clone()));
    assert_eq!(
        record_hash(&a),
        record_hash(&Record {
            id: "2".into(),
            ..a
        })
    );
}

#[test]
fn merge_newer_incoming_wins() {
    let store = seeded(&[stamped("1", b"old", 1000)]);
    assert_eq!(
        store.merge_records(&[stamped("1", b"new", 2000)]).unwrap(),
        1
    );

    let got = row(&store, "1");
    assert_eq!(got.payload, b"new");
    assert_eq!(got.updated_at, 2000);
}

#[test]
fn merge_older_incoming_is_a_no_op() {
    let store = seeded(&[stamped("1", b"local", 2000)]);
    let before = row(&store, "1");

    assert_eq!(
        store
            .merge_records(&[stamped("1", b"stale", 1000)])
            .unwrap(),
        0
    );
    // Byte-identical, timestamps included: the loser must not touch the row.
    assert_eq!(row(&store, "1"), before);
}

#[test]
fn merge_inserts_unknown_record_verbatim() {
    let store = seeded(&[]);
    let mut incoming = stamped("1", b"fresh", 222);
    incoming.created_at = 111;

    assert_eq!(store.merge_records(&[incoming]).unwrap(), 1);

    let got = row(&store, "1");
    // created_at is carried over, not re-stamped to now as upsert would.
    assert_eq!((got.created_at, got.updated_at), (111, 222));
    assert_eq!(got.payload, b"fresh");
}

#[test]
fn merge_newer_tombstone_beats_older_edit() {
    let store = seeded(&[stamped("1", b"live", 1000)]);
    assert_eq!(store.merge_records(&[tombstone("1", 2000)]).unwrap(), 1);

    assert_eq!(store.get("1").unwrap(), None);
    assert_eq!(row(&store, "1").deleted_at, Some(2000));
}

// The mirror case: an edit made after the delete resurrects the entry. That is
// LWW working, not a bug — the user's later intent wins.
#[test]
fn merge_newer_edit_beats_older_tombstone() {
    let store = seeded(&[tombstone("1", 1000)]);
    assert_eq!(
        store
            .merge_records(&[stamped("1", b"revived", 2000)])
            .unwrap(),
        1
    );

    let got = store.get("1").unwrap().unwrap();
    assert_eq!(got.payload, b"revived");
    assert_eq!(got.deleted_at, None);
}

#[test]
fn merge_tie_on_identical_content_writes_nothing() {
    let store = seeded(&[stamped("1", b"same", 1000)]);
    let mine = store.export_for_sync().unwrap();
    assert_eq!(store.merge_records(&mine).unwrap(), 0);
}

// The convergence property. On an exact timestamp tie the two sides hold
// different content, so *someone* must yield — and both must pick the same
// side, or they diverge permanently and push at each other forever.
#[test]
fn merge_tie_picks_the_same_winner_on_both_sides() {
    let a = seeded(&[stamped("1", b"aaa", 5000)]);
    let b = seeded(&[stamped("1", b"bbb", 5000)]);
    let (from_a, from_b) = (a.export_for_sync().unwrap(), b.export_for_sync().unwrap());

    a.merge_records(&from_b).unwrap();
    b.merge_records(&from_a).unwrap();

    assert_eq!(a.state_digest().unwrap(), b.state_digest().unwrap());
    // Exactly one of the two payloads survived on both sides.
    let payload = row(&a, "1").payload;
    assert_eq!(payload, row(&b, "1").payload);
    assert!(payload == b"aaa" || payload == b"bbb");
}

#[test]
fn merge_is_idempotent() {
    let source = seeded(&[stamped("1", b"x", 1000), stamped("2", b"y", 2000)]);
    let target = seeded(&[stamped("1", b"older", 500)]);
    let export = source.export_for_sync().unwrap();

    assert_eq!(target.merge_records(&export).unwrap(), 2);
    let digest = target.state_digest().unwrap();

    // Replaying the same batch is a no-op — every record now ties itself.
    assert_eq!(target.merge_records(&export).unwrap(), 0);
    assert_eq!(target.state_digest().unwrap(), digest);
}

#[test]
fn merge_is_commutative_across_divergent_stores() {
    let a = seeded(&[
        stamped("1", b"a1", 100), // b wins
        stamped("2", b"a2", 300), // a wins
        stamped("3", b"a3", 100), // only in a
    ]);
    let b = seeded(&[
        stamped("1", b"b1", 200),
        stamped("2", b"b2", 200),
        stamped("4", b"b4", 100), // only in b
    ]);
    let (from_a, from_b) = (a.export_for_sync().unwrap(), b.export_for_sync().unwrap());

    a.merge_records(&from_b).unwrap();
    b.merge_records(&from_a).unwrap();

    assert_eq!(a.state_digest().unwrap(), b.state_digest().unwrap());
    assert_eq!(row(&a, "1").payload, b"b1");
    assert_eq!(row(&a, "2").payload, b"a2");
    // Records held by only one side are additions, never conflicts.
    assert_eq!(a.export_for_sync().unwrap().len(), 4);
}

#[test]
fn merge_preserves_timestamps_end_to_end() {
    let mut original = stamped("1", b"x", 222);
    original.created_at = 111;
    let a = seeded(&[original]);
    let b = seeded(&[]);

    b.merge_records(&a.export_for_sync().unwrap()).unwrap();

    assert_eq!(row(&b, "1"), row(&a, "1"));
}

#[test]
fn state_digest_matches_exactly_on_equal_state() {
    let rows = [stamped("1", b"x", 100), stamped("2", b"y", 200)];
    let a = seeded(&rows);
    let b = seeded(&rows);
    assert_eq!(a.state_digest().unwrap(), b.state_digest().unwrap());

    // Any content change moves the digest.
    b.merge_records(&[stamped("2", b"changed", 300)]).unwrap();
    assert_ne!(a.state_digest().unwrap(), b.state_digest().unwrap());
}

// Tombstones are state: a vault that has seen a delete is not the same vault as
// one that never held the row, and the digest has to say so or the delete never
// propagates.
#[test]
fn state_digest_counts_tombstones() {
    let a = seeded(&[stamped("1", b"x", 100)]);
    let b = seeded(&[stamped("1", b"x", 100), tombstone("2", 100)]);
    assert_ne!(a.state_digest().unwrap(), b.state_digest().unwrap());

    b.purge_tombstones_before(200).unwrap();
    assert_eq!(a.state_digest().unwrap(), b.state_digest().unwrap());
}

#[test]
fn purge_tombstones_before_spares_live_and_recent_rows() {
    let store = seeded(&[
        stamped("live", b"x", 1000),
        tombstone("old", 1000),
        tombstone("recent", 9000),
    ]);

    assert_eq!(store.purge_tombstones_before(5000).unwrap(), 1);

    let mut ids: Vec<String> = store
        .export_for_sync()
        .unwrap()
        .into_iter()
        .map(|r| r.id)
        .collect();
    ids.sort();
    assert_eq!(ids, ["live", "recent"]);
}

// Restore scrubs the source device's sync bookkeeping by prefix. The match must
// be a literal prefix — `_` is a LIKE wildcard, so a naive `LIKE 'sync_%'` would
// also eat `syncopation`, and the dirty flag must fall inside the namespace or
// the restored vault starts life believing it has unpushed work.
#[test]
fn meta_delete_prefix_removes_only_the_namespace() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    store.upsert(&rec("1", b"x")).unwrap(); // sets sync_dirty
    store.meta_set("sync_last_digest", "deadbeef").unwrap();
    store.meta_set("syncopation", "keep").unwrap();
    store.meta_set("kdf", "argon2id").unwrap();

    assert_eq!(store.meta_delete_prefix(SYNC_META_PREFIX).unwrap(), 2);

    assert!(!store.is_dirty().unwrap());
    assert_eq!(store.meta_get("sync_last_digest").unwrap(), None);
    assert_eq!(
        store.meta_get("syncopation").unwrap().as_deref(),
        Some("keep")
    );
    assert_eq!(store.meta_get("kdf").unwrap().as_deref(), Some("argon2id"));
}

#[test]
fn dirty_flag_tracks_user_writes_only() {
    let store = SqliteStore::open(&tmp_db(), KEY).unwrap();
    assert!(!store.is_dirty().unwrap());

    store.upsert(&rec("1", b"x")).unwrap();
    assert!(store.is_dirty().unwrap());
    store.clear_dirty().unwrap();
    assert!(!store.is_dirty().unwrap());

    store.delete("1").unwrap();
    assert!(store.is_dirty().unwrap());
    store.clear_dirty().unwrap();

    store.import(&[stamped("2", b"y", 1000)]).unwrap();
    assert!(store.is_dirty().unwrap());
    store.clear_dirty().unwrap();

    // A merge is a peer's write, and a brand backfill is derived metadata —
    // neither is a local edit, so neither may re-trigger a push cycle.
    assert_eq!(store.merge_records(&[stamped("2", b"z", 2000)]).unwrap(), 1);
    store.set_card_brand("2", "visa").unwrap();
    assert!(!store.is_dirty().unwrap());
}
