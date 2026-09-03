use super::export::{sanitize_cell, to_bitwarden_json, to_generic_csv};
use super::{detect, EntryKind, Format, ImportedEntry, ImportedPasskey, Importer};

fn parse(fmt: Format, bytes: &[u8]) -> super::ImportResult {
    fmt.importer().parse(bytes)
}

#[test]
fn bitwarden_maps_login_note_card_and_flags_unsupported() {
    let json = br#"{"items":[
      {"type":1,"name":"GitHub","notes":"n","login":{"username":"octo","password":"pw","totp":"OTP","uris":[{"uri":"https://github.com"}]}},
      {"type":2,"name":"Secret","notes":"body"},
      {"type":3,"name":"Visa","card":{"cardholderName":"A B","number":"4111","expMonth":"01","expYear":"30","code":"123"}},
      {"type":4,"name":"Identity"}
    ]}"#;
    let r = parse(Format::Bitwarden, json);
    assert_eq!(r.entries.len(), 3);
    assert_eq!(r.errors.len(), 1);
    assert_eq!(r.errors[0].row, 4);

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
