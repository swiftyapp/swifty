use super::export::{sanitize_cell, to_bitwarden_json, to_cxf_json, to_generic_csv};
use super::{detect, EntryKind, Format, ImportedEntry, ImportedPasskey, Importer};

fn parse(fmt: Format, bytes: &[u8]) -> super::ImportResult {
    fmt.importer().parse(bytes)
}

#[test]
fn bitwarden_maps_every_item_type_and_flags_unsupported() {
    let json = br#"{"items":[
      {"type":1,"name":"GitHub","notes":"n","login":{"username":"octo","password":"pw","totp":"OTP","uris":[{"uri":"https://github.com"}]}},
      {"type":2,"name":"Secret","notes":"body"},
      {"type":3,"name":"Visa","card":{"cardholderName":"A B","number":"4111","expMonth":"01","expYear":"30","code":"123"}},
      {"type":4,"name":"Passport","identity":{"firstName":"Ada","lastName":"Lovelace","country":"GBR","passportNumber":"X1234567"}},
      {"type":9,"name":"Whatever"}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert_eq!(r.entries.len(), 4);
    assert_eq!(r.errors.len(), 1);
    assert_eq!(r.errors[0].row, 5);

    let login = &r.entries[0];
    assert_eq!(login.kind, EntryKind::Login);
    assert_eq!(login.title, "GitHub");
    assert_eq!(login.username.as_deref(), Some("octo"));
    assert_eq!(login.url.as_deref(), Some("https://github.com"));
    assert_eq!(login.otp.as_deref(), Some("OTP"));

    assert_eq!(r.entries[1].kind, EntryKind::Note);
    let card = &r.entries[2];
    assert_eq!(card.kind, EntryKind::Card);
    assert_eq!(card.card_number.as_deref(), Some("4111"));
    assert_eq!(card.cardholder.as_deref(), Some("A B"));

    let identity = &r.entries[3];
    assert_eq!(identity.kind, EntryKind::Identity);
    assert_eq!(identity.doc_type.as_deref(), Some("passport"));
    assert_eq!(identity.doc_number.as_deref(), Some("X1234567"));
    assert_eq!(identity.doc_country.as_deref(), Some("GBR"));
    assert_eq!(identity.holder_name.as_deref(), Some("Ada Lovelace"));
}

// A licence number is the only thing in a Bitwarden identity that says what the
// document is, so it also decides the type.
#[test]
fn bitwarden_reads_a_licence_number_as_a_driver_licence() {
    let json = br#"{"items":[
      {"type":4,"name":"Licence","identity":{"firstName":"Ada","middleName":"King","lastName":"Lovelace","licenseNumber":"D-99"}}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert!(r.errors.is_empty());
    let identity = &r.entries[0];
    assert_eq!(identity.doc_type.as_deref(), Some("driver_license"));
    assert_eq!(identity.doc_number.as_deref(), Some("D-99"));
    assert_eq!(identity.holder_name.as_deref(), Some("Ada King Lovelace"));
}

// The identity is written into Bitwarden's own members, so it comes back as the
// same document — bar the first/last split, which the full name absorbs again.
#[test]
fn round_trip_bitwarden_identity() {
    let entries = vec![
        ImportedEntry {
            kind: EntryKind::Identity,
            title: "Passport".into(),
            doc_type: Some("passport".into()),
            doc_number: Some("X1234567".into()),
            doc_country: Some("GBR".into()),
            holder_name: Some("ADA LOVELACE".into()),
            ..Default::default()
        },
        ImportedEntry {
            kind: EntryKind::Identity,
            title: "Licence".into(),
            doc_type: Some("driver_license".into()),
            doc_number: Some("D-99".into()),
            holder_name: Some("Mononym".into()),
            ..Default::default()
        },
    ];
    let bytes = to_bitwarden_json(&entries).unwrap();
    let out: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(out["items"][0]["type"], 4);
    assert_eq!(out["items"][0]["identity"]["passportNumber"], "X1234567");
    assert_eq!(out["items"][1]["identity"]["licenseNumber"], "D-99");

    let back = parse(Format::Bitwarden, &bytes);
    assert!(back.errors.is_empty(), "{:?}", back.errors);
    assert_eq!(back.entries, entries);
}

// Bitwarden's custom fields are the extras: text and hidden are values a person
// typed, boolean and linked are its own machinery and have nothing to carry.
#[test]
fn bitwarden_reads_text_and_hidden_fields_as_extras() {
    let json = br#"{"items":[
      {"type":4,"name":"Licence","identity":{"licenseNumber":"D-99"},"fields":[
        {"name":"Categories","value":"B, BE","type":0},
        {"name":"Restrictions","value":"01","type":1},
        {"name":"Favourite","value":"true","type":2},
        {"name":"Linked","value":"3","type":3},
        {"name":"","value":"","type":0},
        {"name":"Issuer note"}
      ]}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert!(r.errors.is_empty(), "{:?}", r.errors);
    assert_eq!(
        r.entries[0].extra,
        vec![
            ("Categories".into(), "B, BE".into()),
            ("Restrictions".into(), "01".into()),
            // No type at all reads as text, and a value-less field is still a
            // label the user wrote.
            ("Issuer note".into(), String::new()),
        ]
    );
}

// Extras belong to no kind, so a login keeps them too — and comes back with the
// same pairs in the same order.
#[test]
fn round_trip_bitwarden_extras() {
    let entries = vec![ImportedEntry {
        kind: EntryKind::Login,
        title: "Acme".into(),
        username: Some("alice".into()),
        extra: vec![
            ("Account ID".into(), "42".into()),
            ("Blood type".into(), "O+".into()),
        ],
        ..Default::default()
    }];
    let bytes = to_bitwarden_json(&entries).unwrap();
    let out: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(out["items"][0]["fields"][0]["name"], "Account ID");
    assert_eq!(out["items"][0]["fields"][0]["type"], 0);
    assert_eq!(out["items"][0]["fields"][1]["value"], "O+");

    let back = parse(Format::Bitwarden, &bytes);
    assert!(back.errors.is_empty(), "{:?}", back.errors);
    assert_eq!(back.entries, entries);
}

// An export of a vault with no extras never mentions custom fields.
#[test]
fn bitwarden_export_omits_fields_without_extras() {
    let entries = vec![ImportedEntry {
        kind: EntryKind::Note,
        title: "Wifi".into(),
        notes: Some("on the router".into()),
        ..Default::default()
    }];
    let bytes = to_bitwarden_json(&entries).unwrap();
    let out: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(out["items"][0].get("fields").is_none());
}

#[test]
fn bitwarden_maps_fido2_credentials_onto_passkeys() {
    let json = br#"{"items":[
      {"type":1,"name":"Acme","login":{"username":"alice","fido2Credentials":[
        {"credentialId":"Y3JlZDE","keyType":"public-key","keyAlgorithm":"ECDSA","keyCurve":"P-256",
         "keyValue":"cGsx","rpId":"acme.test","rpName":"Acme","userHandle":"dWgx","userName":"alice",
         "userDisplayName":"Alice","counter":"7","discoverable":"true",
         "creationDate":"2024-01-01T00:00:00.000Z"},
        {"credentialId":"Y3JlZDI","keyValue":"cGsy","rpId":"other.test","userHandle":"dWgy",
         "userName":"bob","userDisplayName":"Bob"}
      ]}}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert!(r.errors.is_empty());
    let passkeys = &r.entries[0].passkeys;
    assert_eq!(passkeys.len(), 2);
    assert_eq!(
        passkeys[0],
        ImportedPasskey {
            credential_id: "Y3JlZDE".into(),
            rp_id: "acme.test".into(),
            rp_name: Some("Acme".into()),
            user_handle: "dWgx".into(),
            user_name: "alice".into(),
            user_display_name: "Alice".into(),
            private_key: "cGsx".into(),
            counter: 7,
            created_at: Some("2024-01-01T00:00:00.000Z".into()),
        }
    );
    // Optional fields absent: no rpName/creationDate, counter defaults to 0.
    assert_eq!(passkeys[1].credential_id, "Y3JlZDI");
    assert_eq!(passkeys[1].private_key, "cGsy");
    assert_eq!(passkeys[1].rp_name, None);
    assert_eq!(passkeys[1].created_at, None);
    assert_eq!(passkeys[1].counter, 0);
}

// An unusable credential — wrong algorithm, or missing its id / rp / key — is
// dropped on its own, one error each; the login and its good passkey import.
#[test]
fn bitwarden_drops_unsupported_or_incomplete_passkeys() {
    let json = br#"{"items":[
      {"type":1,"name":"Acme","login":{"username":"alice","fido2Credentials":[
        {"credentialId":"a","keyAlgorithm":"RSA","keyValue":"k","rpId":"acme.test"},
        {"credentialId":"b","keyAlgorithm":"ECDSA","keyCurve":"P-256","keyValue":"k","rpId":"acme.test"},
        {"credentialId":"c","rpId":"acme.test"},
        {"credentialId":"","keyValue":"k","rpId":"acme.test"},
        {"credentialId":"d","keyValue":"k"}
      ]}}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].username.as_deref(), Some("alice"));
    assert_eq!(r.entries[0].passkeys.len(), 1);
    assert_eq!(r.entries[0].passkeys[0].credential_id, "b");
    assert_eq!(r.errors.len(), 4);
    assert!(r
        .errors
        .iter()
        .all(|e| e.row == 1 && e.message.contains("passkey")));
}

// Bitwarden writes `counter` as a string; a numeric one is taken as-is rather
// than failing the whole file.
#[test]
fn bitwarden_accepts_a_numeric_passkey_counter() {
    let json = br#"{"items":[
      {"type":1,"name":"Acme","login":{"fido2Credentials":[
        {"credentialId":"a","keyValue":"k","rpId":"acme.test","counter":3}
      ]}}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert!(r.errors.is_empty());
    assert_eq!(r.entries[0].passkeys[0].counter, 3);
}

#[test]
fn bitwarden_login_without_fido2_credentials_has_no_passkeys() {
    let json = br#"{"items":[{"type":1,"name":"Acme","login":{"username":"alice"}}]}"#;
    let r = parse(Format::Bitwarden, json);
    assert!(r.errors.is_empty());
    assert!(r.entries[0].passkeys.is_empty());
}

#[test]
fn generic_csv_maps_by_header_aliases() {
    let csv = b"name,url,username,password,note\nGitHub,https://github.com,octo,pw,hello\n";
    let r = parse(Format::GenericCsv, csv);
    assert_eq!(r.entries.len(), 1);
    assert!(r.errors.is_empty());
    let e = &r.entries[0];
    assert_eq!(e.title, "GitHub");
    assert_eq!(e.username.as_deref(), Some("octo"));
    assert_eq!(e.password.as_deref(), Some("pw"));
    assert_eq!(e.notes.as_deref(), Some("hello"));
}

#[test]
fn browser_csv_maps_safari_headers() {
    let csv = b"Title,URL,Username,Password,Notes,OTPAuth\nMail,https://mail.com,me,secret,,SEED\n";
    let r = parse(Format::BrowserCsv, csv);
    assert_eq!(r.entries.len(), 1);
    let e = &r.entries[0];
    assert_eq!(e.title, "Mail");
    assert_eq!(e.url.as_deref(), Some("https://mail.com"));
    assert_eq!(e.otp.as_deref(), Some("SEED"));
}

#[test]
fn lastpass_csv_splits_logins_and_secure_notes() {
    let csv = b"url,username,password,totp,extra,name,grouping,fav\n\
        https://site.com,user,pw,SEED,,My Site,Personal,0\n\
        http://sn,,,,note body,My Note,Personal,0\n";
    let r = parse(Format::LastpassCsv, csv);
    assert_eq!(r.entries.len(), 2);
    assert_eq!(r.entries[0].kind, EntryKind::Login);
    assert_eq!(r.entries[0].tags, vec!["Personal".to_string()]);
    assert_eq!(r.entries[0].otp.as_deref(), Some("SEED"));
    assert_eq!(r.entries[1].kind, EntryKind::Note);
    assert_eq!(r.entries[1].notes.as_deref(), Some("note body"));
}

#[test]
fn keepass_csv_maps_group_to_tag() {
    let csv = b"Group,Title,Username,Password,URL,Notes,TOTP\n\
        Root/Web,GitHub,octo,pw,https://github.com,note,SEED\n";
    let r = parse(Format::KeepassCsv, csv);
    assert_eq!(r.entries.len(), 1);
    let e = &r.entries[0];
    assert_eq!(e.title, "GitHub");
    assert_eq!(e.tags, vec!["Web".to_string()]);
    assert_eq!(e.otp.as_deref(), Some("SEED"));
}

// A malformed/empty row is reported but never aborts the batch.
#[test]
fn malformed_row_does_not_abort_batch() {
    let csv = b"name,url,username,password\n\
        Good,https://a.com,u,p\n\
        ,,,\n\
        Also,https://b.com,u2,p2\n";
    let r = parse(Format::GenericCsv, csv);
    assert_eq!(r.entries.len(), 2);
    assert_eq!(r.errors.len(), 1);
    assert_eq!(r.errors[0].row, 3); // the empty middle row
    assert_eq!(r.entries[0].title, "Good");
    assert_eq!(r.entries[1].title, "Also");
}

// Dry-run reports the would-be count and every row error without any side effect
// (the parser itself never writes — the command just skips the store on dry_run).
#[test]
fn dry_run_counts_match_parse() {
    let json = br#"{"items":[
      {"type":1,"name":"A","login":{"username":"a"}},
      {"type":9,"name":"bad"},
      {"type":1,"name":"B","login":{"username":"b"}}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert_eq!(r.entries.len(), 2); // imported_would_be
    assert_eq!(r.errors.len(), 1);
}

#[test]
fn sanitize_neutralizes_formula_cells() {
    assert_eq!(sanitize_cell("=cmd|'/c calc'"), "'=cmd|'/c calc'");
    assert_eq!(sanitize_cell("+1"), "'+1");
    assert_eq!(sanitize_cell("-1"), "'-1");
    assert_eq!(sanitize_cell("@x"), "'@x");
    assert_eq!(sanitize_cell("\treally"), "'\treally");
    assert_eq!(sanitize_cell("safe"), "safe");
    assert_eq!(sanitize_cell(""), "");
}

#[test]
fn csv_export_sanitizes_injection() {
    let entries = vec![ImportedEntry {
        kind: EntryKind::Login,
        title: "=HYPERLINK(\"http://evil\")".into(),
        username: Some("+44".into()),
        ..Default::default()
    }];
    let out = String::from_utf8(to_generic_csv(&entries).unwrap()).unwrap();
    assert!(out.contains("'=HYPERLINK"));
    assert!(out.contains("'+44"));
}

// Export -> import round-trips logins through both formats.
#[test]
fn round_trip_generic_csv() {
    let entries = vec![ImportedEntry {
        kind: EntryKind::Login,
        title: "Acme".into(),
        username: Some("neo".into()),
        password: Some("trinity".into()),
        url: Some("https://acme.test".into()),
        notes: Some("hi".into()),
        otp: Some("SEED".into()),
        ..Default::default()
    }];
    let bytes = to_generic_csv(&entries).unwrap();
    let back = super::csv::GenericCsv.parse(&bytes);
    assert!(back.errors.is_empty());
    assert_eq!(back.entries.len(), 1);
    let e = &back.entries[0];
    assert_eq!(e.title, "Acme");
    assert_eq!(e.username.as_deref(), Some("neo"));
    assert_eq!(e.password.as_deref(), Some("trinity"));
    assert_eq!(e.otp.as_deref(), Some("SEED"));
}

#[test]
fn round_trip_bitwarden_json() {
    let entries = vec![
        ImportedEntry {
            kind: EntryKind::Login,
            title: "Acme".into(),
            username: Some("neo".into()),
            password: Some("trinity".into()),
            url: Some("https://acme.test".into()),
            otp: Some("SEED".into()),
            ..Default::default()
        },
        ImportedEntry {
            kind: EntryKind::Card,
            title: "Visa".into(),
            card_number: Some("4111".into()),
            card_cvc: Some("123".into()),
            cardholder: Some("Neo".into()),
            ..Default::default()
        },
    ];
    let bytes = to_bitwarden_json(&entries).unwrap();
    let back = super::bitwarden::Bitwarden.parse(&bytes);
    assert!(back.errors.is_empty());
    assert_eq!(back.entries.len(), 2);
    assert_eq!(back.entries[0].username.as_deref(), Some("neo"));
    assert_eq!(back.entries[1].card_number.as_deref(), Some("4111"));
}

fn passkey() -> ImportedPasskey {
    ImportedPasskey {
        credential_id: "Y3JlZDE".into(),
        rp_id: "acme.test".into(),
        rp_name: Some("Acme".into()),
        user_handle: "dWgx".into(),
        user_name: "alice".into(),
        user_display_name: "Alice".into(),
        private_key: "cGsx".into(),
        counter: 42,
        created_at: Some("2024-01-01T00:00:00.000Z".into()),
    }
}

fn login_with_passkeys() -> Vec<ImportedEntry> {
    vec![ImportedEntry {
        kind: EntryKind::Login,
        title: "Acme".into(),
        username: Some("alice".into()),
        passkeys: vec![passkey()],
        ..Default::default()
    }]
}

#[test]
fn bitwarden_export_writes_fido2_credentials_with_the_supported_constants() {
    let bytes = to_bitwarden_json(&login_with_passkeys()).unwrap();
    let out: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let cred = &out["items"][0]["login"]["fido2Credentials"][0];
    assert_eq!(cred["keyType"], "public-key");
    assert_eq!(cred["keyAlgorithm"], "ECDSA");
    assert_eq!(cred["keyCurve"], "P-256");
    assert_eq!(cred["keyValue"], "cGsx");
    assert_eq!(cred["counter"], "42"); // a string, as Bitwarden writes it
    assert_eq!(cred["discoverable"], "true");
    assert_eq!(cred["creationDate"], "2024-01-01T00:00:00.000Z");
}

// No passkeys means no key at all, so a pre-passkey export is byte-identical.
#[test]
fn bitwarden_export_omits_fido2_credentials_without_passkeys() {
    let entries = vec![ImportedEntry {
        kind: EntryKind::Login,
        title: "Acme".into(),
        ..Default::default()
    }];
    let bytes = to_bitwarden_json(&entries).unwrap();
    let out: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(out["items"][0]["login"].get("fido2Credentials").is_none());
    assert!(!String::from_utf8(bytes).unwrap().contains("fido2"));
}

#[test]
fn round_trip_bitwarden_passkeys() {
    let entries = login_with_passkeys();
    let bytes = to_bitwarden_json(&entries).unwrap();
    let back = super::bitwarden::Bitwarden.parse(&bytes);
    assert!(back.errors.is_empty());
    assert_eq!(back.entries[0].passkeys, entries[0].passkeys);
}

// A CXF item carries a list of credentials, so all five types can share one
// item. `creationAt` (Unix seconds) dates the passkeys on it.
#[test]
fn cxf_maps_every_credential_type_on_one_item() {
    let json = br#"{
      "version": {"major": 1, "minor": 0},
      "exporterRpId": "example.com", "exporterDisplayName": "Example", "timestamp": 1700000000,
      "accounts": [{"id": "YWNjdA", "username": "", "email": "", "collections": [], "items": [
        {"id": "aXRlbTE", "creationAt": 1700000000, "modifiedAt": 1700000000,
         "title": "GitHub", "favorite": false, "tags": ["Work"],
         "scope": {"urls": ["https://github.com"], "androidApps": []},
         "credentials": [
           {"type": "basic-auth",
            "username": {"fieldType": "string", "value": "octo"},
            "password": {"fieldType": "concealed-string", "value": "pw"}},
           {"type": "passkey", "credentialId": "Y3JlZDE", "rpId": "github.com",
            "username": "octo", "userDisplayName": "Octo", "userHandle": "dWgx",
            "key": "cGsx", "fido2Extensions": {}},
           {"type": "totp", "secret": "SEED", "period": 30, "digits": 6,
            "algorithm": "sha1", "issuer": "GitHub", "username": "octo"},
           {"type": "note", "content": {"fieldType": "string", "value": "body"}},
           {"type": "future-thing", "whatever": 1}
         ]},
        {"id": "aXRlbTI", "title": "Visa", "credentials": [
           {"type": "credit-card",
            "number": {"fieldType": "concealed-string", "value": "4111111111111111"},
            "fullName": {"fieldType": "string", "value": "A B"},
            "cardType": {"fieldType": "string", "value": "Visa"},
            "verificationNumber": {"fieldType": "concealed-string", "value": "123"},
            "expiryDate": {"fieldType": "year-month", "value": "2030-01"},
            "pin": {"fieldType": "concealed-string", "value": "1234"}}
         ]}
      ]}]
    }"#;
    let r = parse(Format::Cxf, json);
    assert!(r.errors.is_empty(), "{:?}", r.errors);
    assert_eq!(r.entries.len(), 2);

    let login = &r.entries[0];
    assert_eq!(login.kind, EntryKind::Login);
    assert_eq!(login.title, "GitHub");
    assert_eq!(login.username.as_deref(), Some("octo"));
    assert_eq!(login.password.as_deref(), Some("pw"));
    assert_eq!(login.url.as_deref(), Some("https://github.com"));
    assert_eq!(login.otp.as_deref(), Some("SEED"));
    assert_eq!(login.notes.as_deref(), Some("body"));
    assert_eq!(login.tags, vec!["Work".to_string()]);
    assert_eq!(
        login.passkeys,
        vec![ImportedPasskey {
            credential_id: "Y3JlZDE".into(),
            rp_id: "github.com".into(),
            rp_name: None,
            user_handle: "dWgx".into(),
            user_name: "octo".into(),
            user_display_name: "Octo".into(),
            private_key: "cGsx".into(),
            counter: 0,
            // 1700000000 seconds, as the item dates it.
            created_at: Some("2023-11-14T22:13:20+00:00".into()),
        }]
    );

    let card = &r.entries[1];
    assert_eq!(card.kind, EntryKind::Card);
    assert_eq!(card.card_number.as_deref(), Some("4111111111111111"));
    assert_eq!(card.cardholder.as_deref(), Some("A B"));
    assert_eq!(card.card_month.as_deref(), Some("01"));
    assert_eq!(card.card_year.as_deref(), Some("2030"));
    assert_eq!(card.card_cvc.as_deref(), Some("123"));
}

// Nothing but passkeys: still a login, named after the credential since there
// is no basic-auth to name it.
#[test]
fn cxf_passkey_only_item_becomes_a_passkey_only_login() {
    let json = br#"{"version":{"major":1,"minor":0},"accounts":[{"items":[
      {"id":"aQ","title":"Acme","credentials":[
        {"type":"passkey","credentialId":"Y3JlZDE","rpId":"acme.test","username":"alice",
         "userDisplayName":"Alice","userHandle":"dWgx","key":"cGsx"}
      ]}
    ]}]}"#;
    let r = parse(Format::Cxf, json);
    assert!(r.errors.is_empty());
    let e = &r.entries[0];
    assert_eq!(e.kind, EntryKind::Login);
    assert_eq!(e.username.as_deref(), Some("alice"));
    assert_eq!(e.password, None);
    assert_eq!(e.passkeys.len(), 1);
    assert_eq!(e.passkeys[0].created_at, None); // no creationAt on the item
}

// An item whose only credential is a note is a note; an item with nothing we
// can map is a row error, numbered across accounts.
#[test]
fn cxf_maps_note_only_items_and_flags_unmappable_ones() {
    let json = br#"{"version":{"major":1,"minor":0},"accounts":[
      {"items":[{"id":"aQ","title":"Secret","credentials":[
        {"type":"note","content":{"fieldType":"string","value":"body"}}]}]},
      {"items":[{"id":"aQ","title":"Mystery","credentials":[{"type":"ssh-key"}]}]}
    ]}"#;
    let r = parse(Format::Cxf, json);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].kind, EntryKind::Note);
    assert_eq!(r.entries[0].notes.as_deref(), Some("body"));
    assert_eq!(r.errors.len(), 1);
    assert_eq!(r.errors[0].row, 2); // second item overall
}

// A passkey without an id, relying party or key cannot sign; it is dropped on
// its own and the item still imports.
#[test]
fn cxf_skips_a_bad_passkey_but_imports_the_item() {
    let json = br#"{"version":{"major":1,"minor":0},"accounts":[{"items":[
      {"id":"aQ","title":"Acme","credentials":[
        {"type":"basic-auth","username":{"fieldType":"string","value":"alice"}},
        {"type":"passkey","rpId":"acme.test","username":"alice","key":"cGsx"},
        {"type":"passkey","credentialId":"Y3JlZDI","rpId":"acme.test","key":"cGsy"}
      ]}
    ]}]}"#;
    let r = parse(Format::Cxf, json);
    assert_eq!(r.entries.len(), 1);
    assert_eq!(r.entries[0].username.as_deref(), Some("alice"));
    assert_eq!(r.entries[0].passkeys.len(), 1);
    assert_eq!(r.entries[0].passkeys[0].credential_id, "Y3JlZDI");
    assert_eq!(r.errors.len(), 1);
    assert_eq!(r.errors[0].row, 1);
    assert!(r.errors[0].message.contains("passkey"));
}

// Older drafts wrote bare strings where 1.0 wraps values in an EditableField,
// and kept `urls` on the item rather than under `scope`.
#[test]
fn cxf_accepts_bare_field_values_and_item_level_urls() {
    let json = br#"{"version":{"major":1,"minor":0},"accounts":[{"items":[
      {"id":"aQ","title":"Acme","urls":["https://acme.test"],"credentials":[
        {"type":"basic-auth","username":"alice","password":"pw"}
      ]}
    ]}]}"#;
    let r = parse(Format::Cxf, json);
    assert!(r.errors.is_empty());
    assert_eq!(r.entries[0].username.as_deref(), Some("alice"));
    assert_eq!(r.entries[0].password.as_deref(), Some("pw"));
    assert_eq!(r.entries[0].url.as_deref(), Some("https://acme.test"));
}

#[test]
fn cxf_export_writes_a_version_1_0_document() {
    let bytes = to_cxf_json(&login_with_passkeys()).unwrap();
    let out: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(out["version"]["major"], 1);
    assert_eq!(out["version"]["minor"], 0);
    assert_eq!(out["exporterDisplayName"], crate::app::APP_NAME);
    assert_eq!(out["exporterRpId"], super::export::EXPORTER_RP_ID);
    assert!(out["timestamp"].is_i64());

    let creds = &out["accounts"][0]["items"][0]["credentials"];
    assert_eq!(creds[0]["type"], "basic-auth");
    // An absent value is an absent member, not an empty one.
    assert!(creds[0].get("password").is_none());
    assert_eq!(creds[1]["type"], "passkey");
    assert_eq!(creds[1]["credentialId"], "Y3JlZDE");
    assert_eq!(creds[1]["key"], "cGsx");
    assert_eq!(creds[1]["userHandle"], "dWgx");
}

// Export -> import round-trips everything CXF can carry. `counter` and
// `rp_name` have no home in the format, so they come back at their defaults.
#[test]
fn round_trip_cxf() {
    let entries = vec![
        ImportedEntry {
            kind: EntryKind::Login,
            title: "Acme".into(),
            username: Some("neo".into()),
            password: Some("trinity".into()),
            url: Some("https://acme.test".into()),
            notes: Some("hi".into()),
            otp: Some("SEED".into()),
            tags: vec!["Work".into()],
            passkeys: vec![passkey()],
            ..Default::default()
        },
        ImportedEntry {
            kind: EntryKind::Card,
            title: "Visa".into(),
            notes: Some("spare".into()),
            card_number: Some("4111".into()),
            card_month: Some("01".into()),
            card_year: Some("2030".into()),
            card_cvc: Some("123".into()),
            cardholder: Some("Neo".into()),
            ..Default::default()
        },
        ImportedEntry {
            kind: EntryKind::Note,
            title: "Secret".into(),
            notes: Some("body".into()),
            ..Default::default()
        },
    ];
    let bytes = to_cxf_json(&entries).unwrap();
    let back = parse(Format::Cxf, &bytes);
    assert!(back.errors.is_empty(), "{:?}", back.errors);
    assert_eq!(back.entries.len(), 3);

    let expected: Vec<ImportedEntry> = entries
        .iter()
        .cloned()
        .map(|mut e| {
            for p in &mut e.passkeys {
                p.rp_name = None;
                p.counter = 0;
                // The item is dated at export time, and its passkeys with it.
                p.created_at = None;
            }
            e
        })
        .collect();
    let actual: Vec<ImportedEntry> = back
        .entries
        .into_iter()
        .map(|mut e| {
            for p in &mut e.passkeys {
                assert!(p.created_at.is_some());
                p.created_at = None;
            }
            e
        })
        .collect();
    assert_eq!(actual, expected);
}

#[test]
fn from_name_resolves_cxf() {
    assert_eq!(Format::from_name("cxf"), Some(Format::Cxf));
    assert_eq!(Format::from_name("CXF"), Some(Format::Cxf));
    assert_eq!(Format::from_name("fido"), Some(Format::Cxf));
    assert_eq!(Format::from_name("nope"), None);
}

// Both formats are JSON objects, so the sniff has to look inside: CXF declares
// a `version` object and an `accounts` array, Bitwarden neither.
#[test]
fn detect_tells_cxf_from_bitwarden_json() {
    let cxf = br#"{"version":{"major":1,"minor":0},"accounts":[]}"#;
    assert_eq!(detect("export.json", cxf), Some(Format::Cxf));
    assert_eq!(detect("noext", cxf), Some(Format::Cxf));
    assert_eq!(
        detect("bw.json", br#"{"encrypted":false,"items":[]}"#),
        Some(Format::Bitwarden)
    );
    // `accounts` alone (or an unparseable file) is not enough.
    assert_eq!(
        detect("x.json", br#"{"accounts":[]}"#),
        Some(Format::Bitwarden)
    );
    assert_eq!(detect("broken.json", b"{not json"), Some(Format::Bitwarden));
}

#[test]
fn detect_by_extension_and_content() {
    assert_eq!(detect("export.json", b"{}"), Some(Format::Bitwarden));
    assert_eq!(
        detect(
            "lp.csv",
            b"url,username,password,totp,extra,name,grouping,fav\n"
        ),
        Some(Format::LastpassCsv)
    );
    assert_eq!(
        detect("kp.csv", b"Group,Title,Username,Password,URL\n"),
        Some(Format::KeepassCsv)
    );
    assert_eq!(
        detect("x.csv", b"name,url,username,password\n"),
        Some(Format::GenericCsv)
    );
    assert_eq!(
        detect("noext", b"  {\"items\":[]}"),
        Some(Format::Bitwarden)
    );
}
