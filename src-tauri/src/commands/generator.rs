use crate::error::{Error, Result};
use crate::models::{GeneratorOptions, OtpResult};
use rand::seq::SliceRandom;
use rand::Rng;
use std::time::{SystemTime, UNIX_EPOCH};
use totp_rs::{Algorithm, Secret, TOTP};

const LOWER: &str = "abcdefghijklmnopqrstuvwxyz";
const UPPER: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &str = "0123456789";
// Matches the legacy `generate-password` symbol set.
const SYMBOLS: &str = "!@#$%^&*()+_-=}{[]|:;\"/?.><,`~";
// Removed when excludeSimilarCharacters is set (mirrors `generate-password`).
const SIMILAR: &str = "il1Lo0O";

#[tauri::command]
pub fn generate_password(options: GeneratorOptions) -> Result<String> {
    let exclude_similar = options.exclude_similar_characters.unwrap_or(false);
    let exclude = options.exclude.unwrap_or_default();
    let lowercase = options.lowercase.unwrap_or(true);

    let filter = |set: &str| -> Vec<char> {
        set.chars()
            .filter(|c| !(exclude.contains(*c) || (exclude_similar && SIMILAR.contains(*c))))
            .collect()
    };

    let mut pools: Vec<Vec<char>> = Vec::new();
    if lowercase {
        pools.push(filter(LOWER));
    }
    if options.uppercase {
        pools.push(filter(UPPER));
    }
    if options.numbers {
        pools.push(filter(DIGITS));
    }
    if options.symbols {
        pools.push(filter(SYMBOLS));
    }
    pools.retain(|p| !p.is_empty());

    let all: Vec<char> = pools.iter().flatten().copied().collect();
    if all.is_empty() {
        return Err(Error::Other("no character pool for generator".into()));
    }

    let length = options.length.max(1) as usize;
    let strict = options.strict.unwrap_or(false);
    let mut rng = rand::thread_rng();
    let mut chars: Vec<char> = Vec::with_capacity(length);

    // In strict mode, seed one char from each pool so all selected sets appear.
    if strict {
        for pool in &pools {
            if chars.len() < length {
                chars.push(*pool.choose(&mut rng).unwrap());
            }
        }
    }
    while chars.len() < length {
        chars.push(all[rng.gen_range(0..all.len())]);
    }
    chars.shuffle(&mut rng);
    Ok(chars.into_iter().collect())
}

fn totp(secret: &str) -> Result<TOTP> {
    let bytes = Secret::Encoded(secret.to_string())
        .to_bytes()
        .map_err(|e| Error::Other(format!("invalid otp secret: {e:?}")))?;
    // SHA1, 6 digits, 30s period, ±1 window — matches legacy speakeasy defaults.
    Ok(TOTP::new_unchecked(Algorithm::SHA1, 6, 1, 30, bytes))
}

// Generate the current TOTP code for a base32 secret plus seconds left in the window.
#[tauri::command]
pub fn generate_otp(secret: String) -> Result<OtpResult> {
    let code = totp(&secret)?
        .generate_current()
        .map_err(|e| Error::Other(e.to_string()))?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| Error::Other(e.to_string()))?
        .as_secs();
    Ok(OtpResult {
        code,
        time: 30 - (now % 30) as u32,
    })
}

#[tauri::command]
pub fn verify_otp(secret: String, token: String) -> Result<bool> {
    totp(&secret)?
        .check_current(&token)
        .map_err(|e| Error::Other(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(length: u32) -> GeneratorOptions {
        GeneratorOptions {
            length,
            numbers: false,
            symbols: false,
            uppercase: false,
            lowercase: None,
            exclude: None,
            exclude_similar_characters: None,
            strict: None,
        }
    }

    #[test]
    fn respects_length_and_default_lowercase() {
        let pw = generate_password(opts(24)).unwrap();
        assert_eq!(pw.chars().count(), 24);
        assert!(pw.chars().all(|c| c.is_ascii_lowercase()));
    }

    #[test]
    fn honors_excluded_characters() {
        let mut o = opts(200);
        o.exclude = Some("abcdefghijklmnop".into());
        let pw = generate_password(o).unwrap();
        assert!(pw.chars().all(|c| !"abcdefghijklmnop".contains(c)));
    }

    #[test]
    fn strict_includes_every_selected_pool() {
        let o = GeneratorOptions {
            length: 16,
            numbers: true,
            symbols: true,
            uppercase: true,
            lowercase: Some(true),
            exclude: None,
            exclude_similar_characters: None,
            strict: Some(true),
        };
        for _ in 0..50 {
            let pw = generate_password(o.clone()).unwrap();
            assert!(pw.chars().any(|c| c.is_ascii_lowercase()));
            assert!(pw.chars().any(|c| c.is_ascii_uppercase()));
            assert!(pw.chars().any(|c| c.is_ascii_digit()));
            assert!(pw.chars().any(|c| SYMBOLS.contains(c)));
        }
    }

    #[test]
    fn excludes_similar_characters() {
        let mut o = opts(200);
        o.uppercase = true;
        o.numbers = true;
        o.exclude_similar_characters = Some(true);
        let pw = generate_password(o).unwrap();
        assert!(pw.chars().all(|c| !SIMILAR.contains(c)));
    }

    #[test]
    fn errors_when_no_pool_selected() {
        let mut o = opts(10);
        o.lowercase = Some(false);
        assert!(generate_password(o).is_err());
    }

    #[test]
    fn otp_round_trips() {
        let secret = "JBSWY3DPEHPK3PXP"; // "Hello!\xDE\xAD\xBE\xEF" base32
        let otp = generate_otp(secret.to_string()).unwrap();
        assert_eq!(otp.code.len(), 6);
        assert!(otp.time >= 1 && otp.time <= 30);
        assert!(verify_otp(secret.to_string(), otp.code).unwrap());
    }

    #[test]
    fn otp_rejects_malformed_token() {
        let secret = "JBSWY3DPEHPK3PXP";
        assert!(!verify_otp(secret.to_string(), "1".to_string()).unwrap());
    }
}
