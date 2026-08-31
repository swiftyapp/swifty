# Swifty Threat Model

This describes what Swifty protects, what it deliberately does not, and how the
master key moves through the app. It reflects the code in `v1-0-0`; where the
current implementation differs from the planned design, that is called out.

## Architecture in one paragraph

Swifty is a Tauri 2 desktop app: a trusted Rust core plus a system-webview
frontend (React/TypeScript). All cryptography and key handling live in Rust. The
webview never sees the master key; it talks to the core through a fixed,
enumerated list of commands and receives decrypted data only for display. The
vault is a single file stored locally under the OS app-data directory. There is
no account server and no backend that holds user secrets.

## What sits on disk

The whole vault serializes to JSON and is sealed as one AES-256-GCM (AEAD) blob,
written to `vault.swftx`. So at rest, everything — including metadata like titles
and tags — is ciphertext. On top of the whole-file encryption, the individually
sensitive fields (login password, OTP secret, secure-note body, card PIN) are
each encrypted as their own AEAD value, so they stay ciphertext even inside the
in-memory vault and are decrypted only when the user reveals or copies one
(decrypt-on-reveal).

The vault key is derived from the master passphrase with **PBKDF2-HMAC-SHA512
(100,000 iterations)** via `ring`. A per-value 64-byte salt and 16-byte nonce are
used per field. See `src-tauri/src/crypto/mod.rs`.

> **Planned, not yet shipped (honest gaps):**
> - **KDF.** PBKDF2 at 100k iterations is below current OWASP guidance
>   (~210k for PBKDF2-HMAC-SHA512), and the passphrase is pre-hashed with SHA-512
>   for legacy byte-compatibility, which adds no strength. Argon2id with stored
>   params is planned (remediation Phase 2) but is not in `v1-0-0`.
> - **Storage engine.** A SQLite + **SQLCipher** backend
>   (`src-tauri/src/store/`, `rusqlite` with `bundled-sqlcipher`) is implemented
>   and tested in-tree but is **not yet wired into the live vault path**. When it
>   ships, metadata columns become queryable and are encrypted at rest by
>   SQLCipher while secret fields stay app-AEAD; writes become per-row and atomic
>   (WAL). Today `v1-0-0` still uses the single JSON blob above, written with a
>   non-atomic `fs::write`.
> - **Attempt throttling.** There is no failed-unlock backoff yet, so offline
>   guessing against a stolen vault is bounded only by the KDF cost.
> - **Windows file ACLs.** The on-disk file/dir modes are tightened on Unix
>   (`0600`/`0700`); the Windows ACL equivalent is still a TODO.

## Key lifecycle across the process split

1. **Derive on unlock.** The user enters the master passphrase in the webview. It
   is passed once to the Rust core, which derives the key material. The passphrase
   is not stored.
2. **Hold in Rust only.** The derived key lives in the Rust session
   (`state.rs`, `Session.master_key`) wrapped in a zeroizing buffer. It never
   crosses back to the webview. On unlock the webview receives vault metadata plus
   the ciphertext of secret fields; a secret is decrypted and returned to the
   webview only on an explicit `reveal_entry` (view/copy).
3. **Zeroize on lock.** The key buffer is scrubbed from the heap (`zeroize`) when
   it is dropped or replaced, and on lock. Locking happens three ways: an explicit
   Lock action, a **60-second inactivity auto-lock** (armed when the window loses
   focus, cancelled when it regains focus — `autolock.rs`), and on app exit.
4. **Optional biometric unlock (opt-in).** Instead of the in-session key, the key
   material can be stored in the OS keychain behind a biometric gate:
   - **macOS:** a data-protection Keychain item with a `SecAccessControl` of
     `kSecAccessControlBiometryCurrentSet`. Touch ID is enforced by the OS on
     *read*, and the item auto-invalidates if the enrolled fingerprints change.
   - **Windows:** Credential Manager, with a Windows Hello prompt required before
     the read (verify-then-read).
   - **Linux and others:** unsupported; the app reports biometrics unavailable
     rather than store an ungated key.

## What Swifty defends against

- **Device theft / a lost or stolen laptop.** The vault is a local encrypted
  file. Without the master passphrase (or a biometric unlock on that specific
  enrolled device) the contents are unreadable. The key is never persisted in
  plaintext, and auto-lock limits how long an unlocked session stays open.
- **Cloud-provider or sync compromise.** Sync is optional and, in `v1-0-0`,
  disabled. When enabled it uploads only the already-encrypted vault blob to the
  user's own Google Drive; the master passphrase and derived key never leave the
  device. A compromised Drive account or a tapped sync channel yields ciphertext,
  not secrets.
- **Remote server breach.** There is nothing central to breach. Swifty is
  offline-first with no account server, no telemetry, and no phone-home. The only
  outbound request at launch is the signed updater check to GitHub Releases.
- **Passive at-rest access and backups.** Because the on-disk vault is an AEAD
  blob, file-level backups (Time Machine, disk images, cloud file backups) carry
  only ciphertext.
- **A tampered update.** Updater artifacts are minisign-signed; an unsigned or
  modified artifact is rejected. (Caveat: installation is currently silent on
  launch, without a consent prompt — a UX/trust gap that is tracked. The
  signature check is still enforced.)

## What Swifty explicitly does NOT defend against

- **A compromised operating system.** Code running as the user — malware, a
  malicious app with the same privileges, an attacker at local root — can read
  process memory while the vault is unlocked, tamper with the binary, or inject
  into the webview. Swifty cannot protect secrets from the platform it runs on.
- **Keyloggers and screen capture.** The master passphrase (as typed) and any
  revealed secret (as displayed) can be captured by such tools.
- **A coerced or observed unlock.** If the user is compelled to unlock, or a
  biometric is used under duress, the vault opens. Biometric unlock trades some
  resistance here for convenience: anyone who can pass the OS biometric gate on
  that device can unlock.
- **A known master passphrase.** The passphrase is the single root of trust.
  Whoever knows it can decrypt the vault; there is no second factor on the
  encryption itself.
- **The clipboard window.** Copied secrets go to the system clipboard. Swifty
  marks them as concealed and auto-clears after a timeout, but other apps can read
  the clipboard during that window.
- **Physical memory attacks.** Cold-boot or DMA attacks against an unlocked
  session are out of scope.

## Summary

Swifty's security rests on a locally encrypted vault, a key that is derived on
unlock, held only in the Rust process, and zeroized on lock, and the absence of
any server that could be breached. It assumes the user's device and operating
system are trustworthy while the vault is unlocked. It does not try to defend a
device that is already compromised.
