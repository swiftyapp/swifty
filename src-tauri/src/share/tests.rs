use serde_json::json;

use super::envelope::MAX_SHARE_BYTES;
use super::remote::FakeShareRemote;
use super::*;
use crate::error::Error;

// 2023-11-14T22:13:20Z. A fixed clock so the RFC 3339 strings the frontend
// renders can be asserted literally rather than recomputed by the code
// under test.
const NOW: i64 = 1_700_000_000_000;

/// The vault doing the sharing throughout. An account can hold several now, so
/// every call says which one it is asking as.
const VAULT: &str = "a1b2";

fn entry() -> Entry {
    serde_json::from_value(json!({
        "id": "entry-1", "type": "login", "title": "Router",
        "username": "admin", "password": "hunter2",
        "favorite": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-02-01T00:00:00Z",
        "passkeys": [{
            "credentialId": "Y3JlZA", "rpId": "ex.com",
            "userHandle": "dXNlcg", "userName": "admin",
            "userDisplayName": "Admin", "privateKey": "cHJpdmF0ZUtleQ",
            "counter": 0
        }]
    }))
    .unwrap()
}

// A share as an older build left it: marked, dated, and saying nothing about
// which vault it came from.
fn upload_share(remote: &FakeShareRemote, name: &str, expires: Option<i64>) -> String {
    let expires = expires.map(|e| e.to_string());
    let mut properties = vec![(PROP_SHARE, PROP_SHARE_VALUE)];
    if let Some(expires) = &expires {
        properties.push((PROP_EXPIRES_AT, expires));
    }
    remote.upload(name, b"sealed", &properties).unwrap()
}

#[test]
fn a_created_share_is_published_ciphertext_with_its_bookkeeping() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), Some(VAULT), NOW).unwrap();

    assert_eq!(remote.ids(), vec![created.file_id.clone()]);
    assert!(remote.is_public(&created.file_id));

    // The fake lists on the marker like Drive does, so this also proves the
    // marker was written.
    let listed = remote.list().unwrap();
    assert_eq!(listed[0].entry_id.as_deref(), Some("entry-1"));
    assert_eq!(listed[0].kind.as_deref(), Some("login"));
    assert_eq!(listed[0].vault_id.as_deref(), Some(VAULT));
    assert_eq!(listed[0].expires_ms, Some(NOW + SHARE_TTL_MS));

    assert_eq!(created.expires_at, "2023-11-15T22:13:20.000Z");
    assert_eq!(Link::parse(&created.link).unwrap().file_id, created.file_id);

    let stored = remote.bytes(&created.file_id).unwrap();
    assert!(!stored.windows(7).any(|w| w == b"hunter2"));
}

#[test]
fn an_entry_no_recipient_could_download_is_refused_before_upload() {
    let remote = FakeShareRemote::new();
    let mut huge = entry();
    huge.note = Some("x".repeat(MAX_SHARE_BYTES));

    let err = create(&remote, &huge, Some(VAULT), NOW).unwrap_err();
    assert!(matches!(err, Error::EntryTooLargeToShare));
    // Nothing went to Drive: the sender is told, not the recipient later.
    assert!(remote.ids().is_empty());
}

#[test]
fn the_link_opens_the_entry_without_the_sender_s_copy() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), Some(VAULT), NOW).unwrap();

    let opened = open(&remote, &created.link, NOW).unwrap();
    assert_eq!(opened.title, "Router");
    assert_eq!(opened.password.as_deref(), Some("hunter2"));
    assert_eq!(opened.id, "");
    assert!(opened.created_at.is_none());
    assert!(opened.updated_at.is_none());
    assert!(!opened.favorite);
    assert!(opened.passkeys.is_none());
}

// The file may well still be there — the sender's device is what deletes it,
// and it may be off. The recipient's clock is what turns the link off.
#[test]
fn a_link_stops_opening_when_the_share_expires_even_if_the_file_remains() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), Some(VAULT), NOW).unwrap();

    assert!(open(&remote, &created.link, NOW + SHARE_TTL_MS - 1).is_ok());
    assert!(matches!(
        open(&remote, &created.link, NOW + SHARE_TTL_MS).unwrap_err(),
        Error::ShareExpired
    ));
    assert!(remote.is_public(&created.file_id));
}

#[test]
fn a_passkey_only_login_is_refused_before_anything_is_uploaded() {
    let remote = FakeShareRemote::new();
    let mut passkey_only = entry();
    passkey_only.password = None;

    assert_eq!(
        create(&remote, &passkey_only, Some(VAULT), NOW)
            .unwrap_err()
            .to_string(),
        "this login holds only a passkey, and passkeys cannot be shared"
    );
    assert!(remote.ids().is_empty());
}

#[test]
fn a_link_carrying_the_wrong_key_does_not_open_the_share() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), Some(VAULT), NOW).unwrap();
    let impostor = Link {
        file_id: created.file_id,
        key: ShareKey::generate(),
    }
    .format();

    assert!(matches!(
        open(&remote, &impostor, NOW).unwrap_err(),
        Error::ShareLinkInvalid
    ));
}

#[test]
fn a_revoked_share_reads_as_gone() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), Some(VAULT), NOW).unwrap();

    revoke(&remote, &created.file_id).unwrap();
    assert!(remote.ids().is_empty());
    assert!(matches!(
        open(&remote, &created.link, NOW).unwrap_err(),
        Error::ShareExpired
    ));
}

// The fake answers an unknown id with `ShareExpired`, so getting the parse
// failure back is the proof that nothing was fetched.
#[test]
fn a_link_that_is_not_a_link_fails_before_anything_is_fetched() {
    assert!(matches!(
        open(&FakeShareRemote::new(), "https://example.com/share", NOW).unwrap_err(),
        Error::ShareLinkInvalid
    ));
}

#[test]
fn the_sweep_deletes_only_what_is_known_to_have_expired() {
    let remote = FakeShareRemote::new();
    let expired = upload_share(&remote, "a.rowelshare", Some(NOW - 1));
    let live = upload_share(&remote, "b.rowelshare", Some(NOW + 1));
    let undated = upload_share(&remote, "c.rowelshare", None);

    assert_eq!(sweep(&remote, NOW).unwrap(), 1);
    assert!(!remote.ids().contains(&expired));

    let listed = list(&remote, Some(VAULT), NOW).unwrap();
    assert_eq!(
        listed.iter().map(|s| &s.file_id).collect::<Vec<_>>(),
        vec![&live, &undated]
    );
}

// The fake's ids double as its clock, so this file was created at 1ms.
#[test]
fn a_share_with_no_readable_expiry_is_still_given_one_to_show() {
    let remote = FakeShareRemote::new();
    upload_share(&remote, "a.rowelshare", None);

    let listed = list(&remote, Some(VAULT), NOW).unwrap();
    assert_eq!(listed[0].created_at, "1970-01-01T00:00:00.001Z");
    assert_eq!(listed[0].expires_at, "1970-01-02T00:00:00.001Z");
}

// One account, two vaults: each sees its own outstanding shares and nothing of
// the other's, so neither can revoke a link it did not hand out.
#[test]
fn a_list_shows_only_the_asking_vault_s_shares() {
    let remote = FakeShareRemote::new();
    let mine = create(&remote, &entry(), Some(VAULT), NOW).unwrap();
    let theirs = create(&remote, &entry(), Some("beef"), NOW).unwrap();

    let listed = list(&remote, Some(VAULT), NOW).unwrap();
    assert_eq!(
        listed.iter().map(|s| &s.file_id).collect::<Vec<_>>(),
        vec![&mine.file_id]
    );
    assert_eq!(listed[0].vault_id.as_deref(), Some(VAULT));

    // Not listed is not deleted: the other vault still has it.
    assert!(remote.ids().contains(&theirs.file_id));
    let theirs_listed = list(&remote, Some("beef"), NOW).unwrap();
    assert_eq!(theirs_listed[0].file_id, theirs.file_id);
}

// A share from before the property existed belongs to no vault in particular,
// and dropping it from every list would strand a link still in circulation.
#[test]
fn a_share_with_no_vault_id_stays_visible_to_every_vault() {
    let remote = FakeShareRemote::new();
    let old = upload_share(&remote, "a.rowelshare", Some(NOW + 1));

    for asking in [Some(VAULT), Some("beef"), None] {
        let listed = list(&remote, asking, NOW).unwrap();
        assert_eq!(
            listed.iter().map(|s| &s.file_id).collect::<Vec<_>>(),
            vec![&old]
        );
        assert_eq!(listed[0].vault_id, None);
    }
}

// The sweep is the account's, not the vault's: an expired share is dead
// whichever vault published it, and the device that notices should say so.
#[test]
fn the_sweep_clears_an_expired_share_from_another_vault_too() {
    let remote = FakeShareRemote::new();
    let theirs = create(&remote, &entry(), Some("beef"), NOW - SHARE_TTL_MS).unwrap();

    assert!(list(&remote, Some(VAULT), NOW).unwrap().is_empty());
    assert!(!remote.ids().contains(&theirs.file_id));
}

#[test]
fn a_share_that_cannot_be_published_leaves_no_orphan() {
    let remote = FakeShareRemote::new();
    remote.fail_publishing();

    assert!(create(&remote, &entry(), Some(VAULT), NOW).is_err());
    assert!(remote.ids().is_empty());
}
