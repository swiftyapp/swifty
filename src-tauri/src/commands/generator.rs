use crate::error::{Error, Result};
use crate::models::{GeneratorOptions, OtpResult, SshKeyPair};
use crate::otp::{self, OtpAlgorithm, OtpParams};
use rand::seq::SliceRandom;
use rand::Rng;
use ssh_key::{private::PrivateKey, Algorithm as SshAlgorithm, HashAlg, LineEnding};
use std::time::{SystemTime, UNIX_EPOCH};
use totp_rs::{Algorithm, Builder, Secret, Totp};

const LOWER: &str = "abcdefghijklmnopqrstuvwxyz";
const UPPER: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &str = "0123456789";
// Matches the legacy `generate-password` symbol set.
const SYMBOLS: &str = "!@#$%^&*()+_-=}{[]|:;\"/?.><,`~";
// Removed when excludeSimilarCharacters is set (mirrors `generate-password`).
const SIMILAR: &str = "il1Lo0O";

/// The longest password this will generate. The UI's slider stops at 48
/// (`LENGTH_RANGE` in `src/services/generator.ts`); this leaves room well past
/// it for a caller that wants one. The bound is what keeps `length` from being
/// a memory request: the field is a u32 on the wire, and without a ceiling
/// `{ length: 4294967295 }` asks for a 16 GiB allocation before a single
/// character is chosen.
const MAX_LENGTH: usize = 256;

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

    let length = (options.length.max(1) as usize).min(MAX_LENGTH);
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

/// A new ed25519 SSH keypair. Unencrypted on purpose: the vault is the
/// protection, and a passphrase the app chose would be one more secret to keep
/// somewhere. `comment` is the trailing label on the public line, empty when
/// the caller has nothing to say.
#[tauri::command]
pub fn generate_ssh_key(comment: Option<String>) -> Result<SshKeyPair> {
    let err = |e: ssh_key::Error| Error::Other(format!("could not generate an SSH key: {e}"));
    let mut key =
        PrivateKey::random(&mut rand::thread_rng(), SshAlgorithm::Ed25519).map_err(err)?;
    key.set_comment(comment.unwrap_or_default());

    Ok(SshKeyPair {
        private_key: key.to_openssh(LineEnding::LF).map_err(err)?.to_string(),
        public_key: key.public_key().to_openssh().map_err(err)?,
        fingerprint: key.fingerprint(HashAlg::Sha256).to_string(),
    })
}

// The generator for one already-read stored value. The parameters are not
// optional decoration: an 8-digit or 60-second enrolment generates codes the
// site refuses if they are ignored.
fn totp(params: &OtpParams) -> Result<Totp> {
    let secret = Secret::try_from_base32(&params.secret)
        .map_err(|e| Error::Other(format!("invalid otp secret: {e:?}")))?;
    // ±1 window matches the legacy speakeasy defaults. `build_noncompliant`
    // skips the RFC secret-length and digit checks, exactly as the old
    // `new_unchecked` did: stored secrets are whatever the issuer handed the
    // user, and refusing a short one would lock them out.
    Ok(Builder::new()
        .with_algorithm(match params.algorithm {
            OtpAlgorithm::Sha1 => Algorithm::SHA1,
            OtpAlgorithm::Sha256 => Algorithm::SHA256,
            OtpAlgorithm::Sha512 => Algorithm::SHA512,
        })
        // `otp::DIGITS` caps the count at 10, so the cast cannot truncate.
        .with_digits(params.digits as u8)
        .with_skew(1)
        .with_step_duration(params.period)
        .with_secret(secret)
        .build_noncompliant())
}

// Seconds since the Unix epoch: the step counter a code is derived from, and the
// same reading the window countdown is measured against.
fn unix_now() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| Error::Other(e.to_string()))?
        .as_secs())
}

// Generate the current TOTP code for a stored secret, plus the seconds left in
// the window and how long that window is — the frontend's ring is drawn to
// scale, and 60-second seeds are not unusual.
#[tauri::command]
pub fn generate_otp(secret: String) -> Result<OtpResult> {
    let now = unix_now()?;
    let params = otp::parse(&secret).map_err(|e| Error::Other(e.to_string()))?;
    let period = params.period;
    Ok(OtpResult {
        // `Token`'s Display zero-pads to the configured digit count, which is
        // exactly the string 5.x's `generate` returned.
        code: totp(&params)?.generate(now).to_string(),
        time: (period - now % period) as u32,
        period: period as u32,
    })
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

    // A length is a request for memory as much as for characters, so it has a
    // ceiling: the largest u32 asks for 16 GiB, and must not get it.
    #[test]
    fn caps_the_length() {
        assert_eq!(
            generate_password(opts(u32::MAX)).unwrap().chars().count(),
            MAX_LENGTH
        );
        // Below the cap the asked-for length is still the one returned.
        assert_eq!(
            generate_password(opts(0)).unwrap().chars().count(),
            1,
            "a zero length still yields one character"
        );
    }

    #[test]
    fn errors_when_no_pool_selected() {
        let mut o = opts(10);
        o.lowercase = Some(false);
        assert!(generate_password(o).is_err());
    }

    // The code has to be the one the secret is currently good for, which is
    // what the vault's own checker would accept.
    #[test]
    fn otp_generates_the_code_for_the_current_step() {
        let secret = "JBSWY3DPEHPK3PXP"; // "Hello!\xDE\xAD\xBE\xEF" base32
        let result = generate_otp(secret.to_string()).unwrap();
        assert_eq!(result.code.len(), 6);
        assert_eq!(result.period, 30);
        assert!(result.time >= 1 && result.time <= 30);
        assert!(totp(&otp::parse(secret).unwrap())
            .unwrap()
            .check(&result.code, unix_now().unwrap())
            .is_some());
    }

    // The bug this guards against: the parameters on an enrolment URI were
    // dropped, so an 8-digit SHA-256 seed generated a 6-digit SHA-1 code the
    // site would never accept — silently, with no way to tell from the dial.
    #[test]
    fn otp_honours_the_parameters_on_an_otpauth_uri() {
        let uri = "otpauth://totp/Acme:me@acme.io?secret=JBSWY3DPEHPK3PXP\
                   &digits=8&period=60&algorithm=SHA256";
        let result = generate_otp(uri.to_string()).unwrap();
        assert_eq!(result.code.len(), 8);
        assert!(result.code.chars().all(|c| c.is_ascii_digit()));
        assert_eq!(result.period, 60);
        assert!(result.time >= 1 && result.time <= 60);
        // A 60s window is a different code from the same seed on 30s, which is
        // what "the parameters were read" actually means here.
        assert!(totp(&otp::parse(uri).unwrap())
            .unwrap()
            .check(&result.code, unix_now().unwrap())
            .is_some());
    }

    // The three strings have to describe one key: parse the private block back
    // and let it re-derive the other two.
    #[test]
    fn ssh_key_parses_back_to_its_own_public_key_and_fingerprint() {
        let pair = generate_ssh_key(Some("alice@laptop".into())).unwrap();
        assert!(pair
            .private_key
            .starts_with("-----BEGIN OPENSSH PRIVATE KEY-----"));
        assert!(pair.public_key.starts_with("ssh-ed25519 "));
        assert!(pair.public_key.ends_with(" alice@laptop"));
        assert!(pair.fingerprint.starts_with("SHA256:"));

        let parsed = PrivateKey::from_openssh(&pair.private_key).unwrap();
        assert!(!parsed.is_encrypted());
        assert_eq!(parsed.public_key().to_openssh().unwrap(), pair.public_key);
        assert_eq!(
            parsed.fingerprint(HashAlg::Sha256).to_string(),
            pair.fingerprint
        );
    }

    #[test]
    fn ssh_keys_are_unique_and_need_no_comment() {
        let bare = generate_ssh_key(None).unwrap();
        // No comment means no trailing label, not an empty one.
        assert_eq!(bare.public_key.split(' ').count(), 2);
        assert_ne!(
            bare.private_key,
            generate_ssh_key(None).unwrap().private_key
        );
    }
}
