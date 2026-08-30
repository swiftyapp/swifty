//! Thin CLI over the public crypto API, used by scripts/crypto-crosscheck.mjs
//! to prove Rust and the Node reference interoperate. Not shipped in the app.

use swifty_lib::crypto::{hash_secret, Cryptor};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("");
    let a = |i: usize| args.get(i).cloned().unwrap_or_default();

    let out = match cmd {
        "hash-secret" => hash_secret(&a(1)),
        "encrypt" => Cryptor::new(&a(1)).encrypt(&a(2)).unwrap(),
        "decrypt" => Cryptor::new(&a(1)).decrypt(&a(2)).unwrap(),
        "encrypt-data" => {
            let value: serde_json::Value = serde_json::from_str(&a(2)).unwrap();
            Cryptor::new(&a(1)).encrypt_data(&value).unwrap()
        }
        "decrypt-data" => {
            let value: serde_json::Value = Cryptor::new(&a(1)).decrypt_data(&a(2)).unwrap();
            serde_json::to_string(&value).unwrap()
        }
        other => {
            eprintln!("unknown command: {other}");
            std::process::exit(1);
        }
    };
    print!("{out}");
}
