use serde_json::json;

use super::remote::FakeShareRemote;
use super::*;

// 2023-11-14T22:13:20Z. A fixed clock so the RFC 3339 strings the frontend
// renders can be asserted literally rather than recomputed by the code
// under test.
const NOW: i64 = 1_700_000_000_000;

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

#[test]
fn a_created_share_is_published_ciphertext_with_its_bookkeeping() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), NOW).unwrap();

    assert_eq!(remote.ids(), vec![created.file_id.clone()]);
    assert!(remote.is_public(&created.file_id));

    let listed = remote.list().unwrap();
    assert_eq!(listed[0].entry_id.as_deref(), Some("entry-1"));
    assert_eq!(listed[0].kind.as_deref(), Some("login"));
    assert_eq!(listed[0].expires_ms, Some(NOW + SHARE_TTL_MS));

    assert_eq!(created.expires_at, "2023-11-15T22:13:20.000Z");
    assert_eq!(Link::parse(&created.link).unwrap().file_id, created.file_id);

    let stored = remote.bytes(&created.file_id).unwrap();
    assert!(!stored.windows(7).any(|w| w == b"hunter2"));
}

#[test]
fn the_link_opens_the_entry_without_the_sender_s_copy() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), NOW).unwrap();

    let opened = open(&remote, &created.link).unwrap();
    assert_eq!(opened.title, "Router");
    assert_eq!(opened.password.as_deref(), Some("hunter2"));
    assert_eq!(opened.id, "");
    assert!(opened.created_at.is_none());
    assert!(opened.updated_at.is_none());
    assert!(!opened.favorite);
    assert!(opened.passkeys.is_none());
}

#[test]
fn a_link_carrying_the_wrong_key_does_not_open_the_share() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), NOW).unwrap();
    let impostor = Link {
        file_id: created.file_id,
        key: ShareKey::generate(),
    }
    .format();

    assert_eq!(
        open(&remote, &impostor).unwrap_err().to_string(),
        "this link does not open the share"
    );
}

#[test]
fn a_revoked_share_reads_as_gone() {
    let remote = FakeShareRemote::new();
    let created = create(&remote, &entry(), NOW).unwrap();

    revoke(&remote, &created.file_id).unwrap();
    assert!(remote.ids().is_empty());
    assert_eq!(
        open(&remote, &created.link).unwrap_err().to_string(),
        crate::sync::drive::SHARE_GONE
    );
}

// The fake answers an unknown id with SHARE_GONE, so getting the parse error
// back is the proof that nothing was fetched.
#[test]
fn a_link_that_is_not_a_link_fails_before_anything_is_fetched() {
    assert_eq!(
        open(&FakeShareRemote::new(), "https://example.com/share")
            .unwrap_err()
            .to_string(),
        "this is not a Swifty share link"
    );
}

#[test]
fn the_sweep_deletes_only_what_is_known_to_have_expired() {
    let remote = FakeShareRemote::new();
    let (past, future) = ((NOW - 1).to_string(), (NOW + 1).to_string());
    let expired = remote
        .upload("a.swshare", b"a", &[(PROP_EXPIRES_AT, &past)])
        .unwrap();
    let live = remote
        .upload("b.swshare", b"b", &[(PROP_EXPIRES_AT, &future)])
        .unwrap();
    let undated = remote.upload("c.swshare", b"c", &[]).unwrap();

    assert_eq!(sweep(&remote, NOW).unwrap(), 1);
    assert!(!remote.ids().contains(&expired));

    let listed = list(&remote, NOW).unwrap();
    assert_eq!(
        listed.iter().map(|s| &s.file_id).collect::<Vec<_>>(),
        vec![&live, &undated]
    );
}

// The fake's ids double as its clock, so this file was created at 1ms.
#[test]
fn a_share_with_no_readable_expiry_is_still_given_one_to_show() {
    let remote = FakeShareRemote::new();
    remote.upload("a.swshare", b"a", &[]).unwrap();

    let listed = list(&remote, NOW).unwrap();
    assert_eq!(listed[0].created_at, "1970-01-01T00:00:00.001Z");
    assert_eq!(listed[0].expires_at, "1970-01-02T00:00:00.001Z");
}

#[test]
fn a_share_that_cannot_be_published_leaves_no_orphan() {
    let remote = FakeShareRemote::new();
    remote.fail_publishing();

    assert!(create(&remote, &entry(), NOW).is_err());
    assert!(remote.ids().is_empty());
}
