use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use coset::{iana, CoseKeyBuilder};
use p256::ecdsa::signature::Verifier;
use p256::ecdsa::{Signature, SigningKey, VerifyingKey};
use p256::pkcs8::{DecodePrivateKey, EncodePrivateKey};
use p256::SecretKey;
use passkey_client::{Client, DefaultClientData};
use passkey_types::{ctap2, encoding, rand::random_vec, webauthn, Bytes};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use super::store::{MemoryVault, PasskeyVault, SessionVault};
use super::{key, Authenticator};
use crate::crypto::{PayloadCipher, VaultKey};
use crate::import::{self, export, EntryKind, ImportedEntry, ImportedPasskey};
use crate::models::{Entry, Passkey};
use crate::store::{migrate, SqliteStore, VaultStore};

const RP_ID: &str = "example.com";
const ORIGIN: &str = "https://example.com";

// --- keys -------------------------------------------------------------------

// A P-256 key as any exporter would hand it to us: PKCS#8 DER, base64url.
fn generated_key() -> (SecretKey, String) {
    let secret = SecretKey::random(&mut rand::thread_rng());
    let der = secret.to_pkcs8_der().unwrap();
    (secret, encoding::base64url(der.as_bytes()))
}

#[test]
fn pkcs8_survives_a_round_trip_through_cose() {
    let (_, pkcs8) = generated_key();

    let cose = key::pkcs8_to_cose(&pkcs8).unwrap();
    assert_eq!(key::cose_to_pkcs8(&cose).unwrap(), pkcs8);
}

#[test]
fn padded_base64url_private_key_is_accepted() {
    let (_, pkcs8) = generated_key();
    let padded = format!("{pkcs8}{}", "=".repeat(pkcs8.len() % 4));

    assert!(key::pkcs8_to_cose(&padded).is_ok());
}

// Bitwarden exports a passkey's credential id as the GUID it minted for it; the
// 16 raw bytes of that GUID are what the site knows the credential by.
#[test]
fn a_guid_credential_id_decodes_to_its_raw_bytes() {
    let raw = key::decode_credential_id("0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0").unwrap();
    assert_eq!(
        raw,
        [
            0x0f, 0x1e, 0x2d, 0x3c, 0x4b, 0x5a, 0x69, 0x78, 0x87, 0x96, 0xa5, 0xb4, 0xc3, 0xd2,
            0xe1, 0xf0
        ]
    );
    // Uppercase hex is a GUID too; a hyphenated string that is not one is
    // still read as base64url.
    assert_eq!(
        key::decode_credential_id("0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0").unwrap(),
        raw
    );
    assert_eq!(key::decode_credential_id("Y3JlZDE").unwrap(), b"cred1");
    assert!(key::decode_credential_id("not-a-guid-or-b64url!").is_err());
}

#[test]
fn a_cose_key_that_is_not_p256_ec2_is_rejected() {
    let symmetric = CoseKeyBuilder::new_symmetric_key(vec![7; 32])
        .algorithm(iana::Algorithm::ES256)
        .build();
    assert!(key::cose_to_pkcs8(&symmetric).is_err());

    // Right key type, wrong curve.
    let p384 = CoseKeyBuilder::new_ec2_priv_key(
        iana::EllipticCurve::P_384,
        vec![1; 48],
        vec![2; 48],
        vec![3; 48],
    )
    .algorithm(iana::Algorithm::ES256)
    .build();
    assert!(key::cose_to_pkcs8(&p384).is_err());
}

#[test]
fn a_zero_counter_maps_to_no_counter_and_back() {
    let stored = imported_passkey(RP_ID);
    let types = key::to_passkey_types(&stored).unwrap();
    assert_eq!(types.counter, None, "a synced passkey reports no counter");

    let user = ctap2::make_credential::PublicKeyCredentialUserEntity {
        id: encoding::try_from_base64url(&stored.user_handle)
            .unwrap()
            .into(),
        name: Some(stored.user_name.clone()),
        display_name: Some(stored.user_display_name.clone()),
        icon_url: None,
    };
    let back = key::from_passkey_types(&types, &user, stored.rp_name.as_deref()).unwrap();
    assert_eq!(back.counter, 0);
    assert_eq!(back.credential_id, stored.credential_id);
    assert_eq!(back.user_handle, stored.user_handle);
    assert_eq!(back.rp_id, stored.rp_id);
}

// --- ceremonies over the in-memory vault ------------------------------------

fn creation_options(exclude: Option<Vec<Bytes>>) -> webauthn::CredentialCreationOptions {
    webauthn::CredentialCreationOptions {
        public_key: webauthn::PublicKeyCredentialCreationOptions {
            rp: webauthn::PublicKeyCredentialRpEntity {
                id: Some(RP_ID.into()),
                name: "Example Inc".into(),
            },
            user: webauthn::PublicKeyCredentialUserEntity {
                id: random_vec(16).into(),
                display_name: "Alice Example".into(),
                name: "alice".into(),
            },
            challenge: random_vec(32).into(),
            pub_key_cred_params: vec![webauthn::PublicKeyCredentialParameters {
                ty: webauthn::PublicKeyCredentialType::PublicKey,
                alg: iana::Algorithm::ES256,
            }],
            timeout: None,
            exclude_credentials: exclude.map(|ids| {
                ids.into_iter()
                    .map(|id| webauthn::PublicKeyCredentialDescriptor {
                        ty: webauthn::PublicKeyCredentialType::PublicKey,
                        id,
                        transports: None,
                    })
                    .collect()
            }),
            authenticator_selection: Default::default(),
            hints: None,
            attestation: Default::default(),
            attestation_formats: Default::default(),
            extensions: Default::default(),
        },
    }
}

fn request_options(credential_id: Bytes) -> webauthn::CredentialRequestOptions {
    webauthn::CredentialRequestOptions {
        public_key: webauthn::PublicKeyCredentialRequestOptions {
            challenge: random_vec(32).into(),
            timeout: None,
            rp_id: Some(RP_ID.into()),
            allow_credentials: Some(vec![webauthn::PublicKeyCredentialDescriptor {
                ty: webauthn::PublicKeyCredentialType::PublicKey,
                id: credential_id,
                transports: None,
            }]),
            user_verification: Default::default(),
            hints: None,
            attestation: Default::default(),
            attestation_formats: Default::default(),
            extensions: Default::default(),
        },
    }
}

// The relying party's side of a sign-in: the assertion signature must verify
// under the public half of the key we kept, over authenticatorData followed by
// the SHA-256 of the client data.
fn assert_signature_verifies(
    private_key_b64url: &str,
    auth_data: &[u8],
    client_data_json: &[u8],
    signature: &[u8],
) {
    let der = encoding::try_from_base64url(private_key_b64url).unwrap();
    let secret = SecretKey::from_pkcs8_der(&der).unwrap();
    let verifying = VerifyingKey::from(SigningKey::from(&secret));

    let mut signed = auth_data.to_vec();
    signed.extend(Sha256::digest(client_data_json));

    verifying
        .verify(&signed, &Signature::from_der(signature).unwrap())
        .expect("assertion signature must verify under the stored key");
}

// One registration through a real WebAuthn client, returning the credential id
// the relying party would keep.
async fn register<V: PasskeyVault>(vault: V) -> Bytes {
    let mut client = Client::new(Authenticator::new(vault).into_ctap2());
    let origin = url::Url::parse(ORIGIN).unwrap();
    client
        .register(&origin, creation_options(None), DefaultClientData)
        .await
        .expect("registration")
        .raw_id
}

#[tokio::test]
async fn registers_and_signs_in_with_a_new_credential() {
    let vault = MemoryVault::new();
    let mut client = Client::new(Authenticator::new(&vault).into_ctap2());
    let origin = url::Url::parse(ORIGIN).unwrap();

    let created = client
        .register(&origin, creation_options(None), DefaultClientData)
        .await
        .expect("registration should succeed");

    let stored = vault.all();
    assert_eq!(stored.len(), 1, "one credential stored");
    let passkey = stored[0].passkey.clone();
    assert_eq!(passkey.rp_id, RP_ID);
    assert_eq!(passkey.rp_name.as_deref(), Some("Example Inc"));
    assert_eq!(passkey.user_name, "alice");
    assert_eq!(passkey.user_display_name, "Alice Example");
    assert!(!passkey.user_handle.is_empty());
    assert_eq!(passkey.counter, 0, "synced credentials keep a zero counter");
    assert_eq!(
        passkey.credential_id,
        encoding::base64url(&created.raw_id),
        "the id the relying party saw is the id we stored"
    );

    let asserted = client
        .authenticate(
            &origin,
            request_options(created.raw_id.clone()),
            DefaultClientData,
        )
        .await
        .expect("sign-in should succeed");

    assert_signature_verifies(
        &passkey.private_key,
        &asserted.response.authenticator_data,
        &asserted.response.client_data_json,
        &asserted.response.signature,
    );
    assert_eq!(
        asserted
            .response
            .user_handle
            .map(|h| encoding::base64url(&h)),
        Some(passkey.user_handle.clone()),
        "the credential is discoverable, so the user handle comes back"
    );
    assert_eq!(
        vault.all()[0].passkey.counter,
        0,
        "signing in must not touch the counter"
    );
}

#[tokio::test]
async fn a_second_registration_for_an_excluded_credential_is_refused() {
    let vault = MemoryVault::new();
    let mut client = Client::new(Authenticator::new(&vault).into_ctap2());
    let origin = url::Url::parse(ORIGIN).unwrap();

    let created = client
        .register(&origin, creation_options(None), DefaultClientData)
        .await
        .expect("first registration");

    let refused = client
        .register(
            &origin,
            creation_options(Some(vec![created.raw_id])),
            DefaultClientData,
        )
        .await;

    assert!(refused.is_err(), "excludeCredentials must be honoured");
    assert_eq!(vault.all().len(), 1, "and nothing new stored");
}

// A raw CTAP2 sign-in request, as the extension host will build one.
fn assertion_request(
    client_data_hash: &[u8],
    allow: Option<Vec<Bytes>>,
) -> ctap2::get_assertion::Request {
    ctap2::get_assertion::Request {
        rp_id: RP_ID.into(),
        client_data_hash: client_data_hash.to_vec().into(),
        allow_list: allow.map(|ids| {
            ids.into_iter()
                .map(|id| webauthn::PublicKeyCredentialDescriptor {
                    ty: webauthn::PublicKeyCredentialType::PublicKey,
                    id,
                    transports: None,
                })
                .collect()
        }),
        extensions: None,
        options: ctap2::get_assertion::Options {
            rk: false,
            up: true,
            uv: true,
        },
        pin_auth: None,
        pin_protocol: None,
    }
}

// A passkey exactly as the Bitwarden importer would leave it: a foreign PKCS#8
// key, base64url ids, counter zero.
fn imported_passkey(rp_id: &str) -> Passkey {
    let (_, private_key) = generated_key();
    Passkey {
        credential_id: encoding::base64url(&random_vec(16)),
        rp_id: rp_id.to_owned(),
        rp_name: Some("Example Inc".into()),
        user_handle: encoding::base64url(&random_vec(16)),
        user_name: "alice".into(),
        user_display_name: "Alice Example".into(),
        private_key,
        counter: 0,
        created_at: Some("2026-01-01T00:00:00+00:00".into()),
    }
}

#[tokio::test]
async fn signs_in_with_an_imported_key() {
    let vault = MemoryVault::new();
    let imported = imported_passkey(RP_ID);
    vault.seed("entry-1", imported.clone());

    let mut authenticator = Authenticator::new(&vault);
    let client_data_hash = random_vec(32);
    // No allow list: the vault's credentials are discoverable.
    let response = authenticator
        .get_assertion(assertion_request(&client_data_hash, None))
        .await
        .expect("an imported passkey must be usable");

    let mut signed = response.auth_data.to_vec();
    signed.extend(&client_data_hash);
    let der = encoding::try_from_base64url(&imported.private_key).unwrap();
    let verifying = VerifyingKey::from(SigningKey::from(&SecretKey::from_pkcs8_der(&der).unwrap()));
    verifying
        .verify(&signed, &Signature::from_der(&response.signature).unwrap())
        .expect("signature must verify under the imported key");

    assert_eq!(vault.all()[0].passkey, imported, "the record is untouched");
}

#[tokio::test]
async fn an_allow_list_matches_a_credential_id_stored_with_padding() {
    let vault = MemoryVault::new();
    let raw = random_vec(16);
    vault.seed(
        "entry-1",
        Passkey {
            credential_id: format!("{}==", encoding::base64url(&raw)),
            ..imported_passkey(RP_ID)
        },
    );

    let mut authenticator = Authenticator::new(&vault);
    let request = assertion_request(&random_vec(32), Some(vec![raw.into()]));

    assert!(
        authenticator.get_assertion(request).await.is_ok(),
        "credential ids are matched as bytes, not as strings"
    );
}

// --- SessionVault over a real store -----------------------------------------

fn tmp_db() -> PathBuf {
    static N: AtomicU64 = AtomicU64::new(0);
    let dir = std::env::temp_dir().join(format!(
        "swifty-passkey-{}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir.join("vault.db")
}

fn session() -> (SqliteStore, PayloadCipher) {
    let store = SqliteStore::open(&tmp_db(), &[0x22; 32]).unwrap();
    let cipher = VaultKey::Argon2 {
        master: Zeroizing::new(vec![7u8; 32]),
    }
    .payload_cipher();
    (store, cipher)
}

fn login(title: &str, website: &str) -> Entry {
    serde_json::from_value(serde_json::json!({
        "id": migrate::new_entry_id(), "type": "login", "title": title,
        "website": website, "username": "alice", "password": "s3cret"
    }))
    .unwrap()
}

// Sealed and upserted exactly as `commands::vault::save_entry` does it.
fn save(store: &SqliteStore, cipher: &PayloadCipher, entry: &Entry) {
    let payload = cipher.seal(entry).unwrap();
    store
        .upsert(&migrate::build_record(entry, payload).unwrap())
        .unwrap();
}

#[test]
fn insert_attaches_to_the_one_login_for_that_host() {
    let (store, cipher) = session();
    let entry = login("Example", "https://example.com/login");
    save(&store, &cipher, &entry);

    let vault = SessionVault::new(&store, &cipher);
    let passkey = imported_passkey(RP_ID);
    vault.insert(&passkey).unwrap();

    assert_eq!(store.list().unwrap().len(), 1, "no new entry was created");
    let found = vault.find(RP_ID).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].entry_id, entry.id);
    assert_eq!(found[0].passkey, passkey);
}

#[test]
fn insert_creates_a_login_when_no_single_host_matches() {
    let (store, cipher) = session();
    // Two logins for the same host: ambiguous, so neither is touched.
    save(&store, &cipher, &login("Work", "https://example.com"));
    save(&store, &cipher, &login("Personal", "https://example.com"));

    let vault = SessionVault::new(&store, &cipher);
    let passkey = imported_passkey(RP_ID);
    vault.insert(&passkey).unwrap();

    let metas = store.list().unwrap();
    assert_eq!(metas.len(), 3, "a third login was opened for the passkey");
    let created = metas
        .iter()
        .find(|m| m.title == "Example Inc")
        .expect("titled after the relying party");
    assert_eq!(created.url_host, RP_ID);

    let found = vault.find(RP_ID).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].entry_id, created.id);

    let entry = cipher
        .unseal(&store.get(&created.id).unwrap().unwrap().payload)
        .unwrap();
    assert_eq!(entry.website.as_deref(), Some("https://example.com"));
    assert_eq!(entry.username.as_deref(), Some("alice"));
}

#[test]
fn find_returns_only_the_passkeys_for_that_relying_party() {
    let (store, cipher) = session();
    let vault = SessionVault::new(&store, &cipher);
    let ours = imported_passkey(RP_ID);
    let theirs = imported_passkey("other.test");
    vault.insert(&ours).unwrap();
    vault.insert(&theirs).unwrap();

    let found = vault.find(RP_ID).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].passkey, ours);
    assert_eq!(vault.find("other.test").unwrap().len(), 1);
    assert!(vault.find("nobody.test").unwrap().is_empty());
}

#[test]
fn update_replaces_the_passkey_in_place() {
    let (store, cipher) = session();
    let vault = SessionVault::new(&store, &cipher);
    let passkey = imported_passkey(RP_ID);
    vault.insert(&passkey).unwrap();
    let entry_id = vault.find(RP_ID).unwrap()[0].entry_id.clone();

    let bumped = Passkey {
        counter: 7,
        ..passkey
    };
    vault.update(&entry_id, &bumped).unwrap();

    let found = vault.find(RP_ID).unwrap();
    assert_eq!(found.len(), 1, "updated, not appended");
    assert_eq!(found[0].passkey.counter, 7);
}

#[tokio::test]
async fn a_registered_passkey_round_trips_through_a_bitwarden_export() {
    let (store, cipher) = session();
    let vault = SessionVault::new(&store, &cipher);

    let credential_id = register(&vault).await;

    let stored = vault.find(RP_ID).unwrap();
    assert_eq!(stored.len(), 1);
    let passkey = stored[0].passkey.clone();
    assert_eq!(passkey.credential_id, encoding::base64url(&credential_id));

    let entry = ImportedEntry {
        kind: EntryKind::Login,
        title: "Example Inc".into(),
        passkeys: vec![to_imported(&passkey)],
        ..Default::default()
    };
    let json = export::to_bitwarden_json(&[entry]).unwrap();
    let back = import::Format::Bitwarden.importer().parse(&json);

    assert!(back.errors.is_empty(), "{:?}", back.errors);
    assert_eq!(back.entries.len(), 1);
    assert_eq!(
        back.entries[0].passkeys,
        vec![to_imported(&passkey)],
        "a passkey we created must survive Bitwarden export + import unchanged"
    );
}

fn to_imported(p: &Passkey) -> ImportedPasskey {
    ImportedPasskey {
        credential_id: p.credential_id.clone(),
        rp_id: p.rp_id.clone(),
        rp_name: p.rp_name.clone(),
        user_handle: p.user_handle.clone(),
        user_name: p.user_name.clone(),
        user_display_name: p.user_display_name.clone(),
        private_key: p.private_key.clone(),
        counter: p.counter,
        created_at: p.created_at.clone(),
    }
}
