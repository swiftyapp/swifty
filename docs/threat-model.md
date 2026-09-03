# Swifty Threat Model

This describes what Swifty protects, what it deliberately does not, and how the
master key moves through the app. It reflects the code merged on `v1-0-0`; where
the current implementation differs from the planned design, that is called out.

## Architecture in one paragraph

Swifty is a Tauri 2 desktop app: a trusted Rust core plus a system-webview
frontend (React/TypeScript). All cryptography and key handling live in Rust. The
webview never sees the master key; it talks to the core through a fixed,
enumerated list of commands (`src-tauri/src/lib.rs`) and receives non-secret
entry metadata for the list plus one decrypted entry at a time on reveal. The
vault is a locally stored, encrypted SQLite database under the OS app-data
directory. There is no account server and no backend that holds user secrets. The
webview is locked down by a strict CSP (`default-src 'self'`, `connect-src
'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`; see
`src-tauri/tauri.conf.json`), and external links are opened through the OS only
for `http`/`https` URLs (`opener:allow-open-url` scope in
`capabilities/default.json`).

## What sits on disk

The vault is a **SQLite database sealed with SQLCipher** (`vault.db`,
`src-tauri/src/store/`, `rusqlite` with `bundled-sqlcipher`). SQLCipher encrypts
the **entire database file at rest** — page contents, the schema, free pages, and
the write-ahead log — with AES-256 and per-page authentication. On disk, nothing
is readable without the database key.

Inside the decrypted database:

- An `entries` table keeps **non-secret metadata in plaintext columns** — `id`,
  `kind`, `title`, `tags`, `url_host`, `created_at`, `updated_at`, `deleted_at` —
  so the list and search work without unsealing anything. These columns are
  protected at rest by SQLCipher, but they are *not* additionally app-encrypted:
  anyone holding the database key sees them in the clear.
- Each row also carries an opaque `payload` BLOB. The storage layer never
  inspects or encrypts it (`src-tauri/src/store/sqlite.rs` documents the payload
  as caller-owned); the application applies its **own AEAD** on top. The whole
  entry is serialized to JSON and sealed as AES-256-GCM (base64-wrapped), and
  each individually sensitive field (login password, OTP secret, secure-note
  body, card PIN) is **also** sealed as its own AES-256-GCM value nested inside.
  So a secret stays ciphertext even inside the *decrypted* database and is
  unsealed only when the user reveals or copies it (**decrypt-on-reveal**,
  `reveal_entry` in `src-tauri/src/commands/vault.rs`).
- A small `meta` key/value table holds app data — the KDF descriptor and similar
  settings — not schema versioning (that rides SQLite's `user_version`).

The practical shape of this two-layer design: an attacker who never obtains the
key sees only SQLCipher ciphertext for everything. Metadata confidentiality rests
on SQLCipher alone; secret fields get a second, app-level AEAD layer whose purpose
is defense-in-depth and decrypt-on-reveal, not hiding metadata from someone who
already has the database key.

Writes are **per-row and atomic** (WAL mode), not a whole-file rewrite: saving one
edited entry re-seals only that row's payload. Deletes are **tombstones**
(`deleted_at` is stamped and the row is retained so a later sync can propagate the
deletion), not hard deletes. On-disk file and directory modes are tightened on
Unix (`0600` file / `0700` dir); the Windows ACL equivalent is still a TODO
(`set_mode` no-ops off Unix in `sqlite.rs`).

### Key derivation (KDF)

From the master password the core derives two keys:

- **The SQLCipher database key** — `HKDF-SHA256` over the session secret with a
  fixed context salt (`crypto::sqlcipher_key`). SQLCipher opens the file with this
  raw key; a wrong password derives a wrong key and the open fails verification,
  which the app surfaces as an invalid password.
- **The payload key** — `PBKDF2-HMAC-SHA512`, 100,000 iterations, with a per-value
  random 64-byte salt (the legacy `Cryptor`, `ring`-backed, in
  `crypto/mod.rs`). This is the key that seals each entry payload and each nested
  secret field.

Both are derived from the same `secret` = `base64(SHA512(master password))`, a
pre-hash kept for byte-compatibility with the legacy `.swftx` vault format. The
KDF descriptor recorded in the `meta` table is currently the placeholder string
`pbkdf2-sha512-100000`.

> **Shipped vs. in progress (honest KDF status):**
> - **Argon2id is landed as a primitive, not yet as the live derivation.**
>   `crypto/kdf.rs` ships a memory-hard **Argon2id** implementation
>   (`m=64 MiB, t=3, p=4`), a versioned, self-describing `KdfParams` descriptor
>   (Argon2id or PBKDF2-SHA512, each carrying its salt), a fresh 32-byte random
>   salt for new params, and a `derive()` dispatcher — all unit-tested, including
>   a known-answer vector. But `setup`, `unlock`, `change_master_password`, and
>   the import paths still derive keys through the PBKDF2/HKDF path above; the
>   `meta` descriptor is a placeholder for the upgrade. Wiring Argon2id into the
>   live path — and persisting its salt/params where they can be read *before* the
>   database is opened (a plaintext sidecar, since Argon2 parameters must be known
>   to derive the key that opens the encrypted DB) — is **in progress**. Once
>   wired, new vaults derive with Argon2id and PBKDF2 remains only to **read
>   legacy `.swftx` backups**.
> - **PBKDF2 strength.** 100,000 iterations of PBKDF2-HMAC-SHA512 is below current
>   OWASP guidance (~210k), and the `SHA-512` pre-hash adds no strength. This is
>   precisely why Argon2id is the target primitive.
> - **Attempt throttling.** There is no failed-unlock backoff, so offline guessing
>   against a stolen database is bounded only by the KDF cost.

### Passkeys

A login entry can hold WebAuthn credentials (`models::Passkey`, one per site
account). They live **inside the sealed payload**, in the entry's `passkeys`
list — there is no passkey column and no separate table, so a credential's
private key gets exactly the protection an entry's password gets: SQLCipher at
rest, the app AEAD on top, unsealed only for the operation that needs it. Sync
carries them as part of the opaque payload and never sees them.

- **The private key never leaves the core.** `src-tauri/src/passkey/` unseals a
  login, converts the stored PKCS#8 key to a COSE key in memory, signs, and drops
  it. No command returns a private key to the webview. The one way a passkey
  leaves the app is an **explicit user-initiated export** (`.swftx`, or Bitwarden
  JSON, which is plaintext by construction and carries the key as base64url) —
  the same deliberate exposure the password export already is.
- **User verification is the unlocked session.** WebAuthn's "user verified" bit
  is asserted on the strength of the vault being unlocked; there is no
  per-ceremony prompt yet, so any code that can reach the authenticator can sign.
  That is only sound while nothing can: the module has no Tauri command and no
  transport, and the browser-extension PR that adds one adds the per-ceremony
  confirmation with it.
- **Signature counters stay at zero.** Credentials sync across devices, so a
  per-device counter would look to a relying party like a cloned authenticator.
  New credentials are created with the constant zero the spec recommends for
  synced keys and are not incremented on sign-in; an imported credential that
  arrived with a non-zero counter keeps counting.
- **The AAGUID is a model identifier, not a device one.** One fixed value for
  every Swifty install (`passkey::AAGUID`), so it cannot be used to correlate a
  user across relying parties.

## Key lifecycle across the process split

1. **Derive off the UI thread on unlock.** The user enters the master passphrase
   in the webview. It is passed once to the Rust core, which derives the key
   material and opens SQLCipher (which runs its own internal KDF) on a blocking
   thread (`spawn_blocking` in `commands/auth.rs`), so the UI never stalls. The
   passphrase itself is not stored.
2. **Hold in Rust only.** The derived secret lives in the Rust session
   (`state.rs`, `Session.master_key`) wrapped in a zeroizing buffer, alongside the
   open encrypted store handle — never a fully decrypted vault. It never crosses
   back to the webview. The webview receives entry metadata plus, on an explicit
   `reveal_entry`, one decrypted entry.
3. **Zeroize on lock.** The key buffer is scrubbed from the heap (`zeroize`) when
   it is dropped or replaced, and the store connection is closed. Locking happens
   several ways: an explicit Lock action, a **60-second inactivity auto-lock**
   (armed when the window loses focus, cancelled when it regains focus —
   `autolock.rs`), and on app exit (the session is dropped).
4. **Optional biometric unlock (opt-in).** Instead of re-entering the passphrase,
   the same key material can be stored in the OS keychain behind a biometric gate
   (`secure_store.rs`):
   - **macOS:** a data-protection Keychain item with a `SecAccessControl` of
     `kSecAccessControlBiometryCurrentSet`. Touch ID is enforced by the OS on
     *read*, and the item auto-invalidates if the enrolled fingerprints change.
   - **Windows:** Credential Manager, with a Windows Hello prompt required before
     the read (verify-then-read).
   - **Linux and others:** unsupported; the app reports biometrics unavailable
     rather than store an ungated key.

## Fresh start and explicit import

`v1-0-0` starts with an **empty SQLite vault**. `is_initialized` is true only when
the encrypted database exists; a legacy `vault.swftx` file alone does **not**
count. Nothing is migrated automatically on unlock.

Bringing an old vault forward is an **explicit** action, and there are two paths
(`commands/vault.rs`):

- **Restore a backup as a new vault** (`import_backup`): decrypt a chosen `.swftx`
  with its password and create the database from it.
- **Import into the currently-unlocked vault** (`import_swftx`): the `.swftx` is
  independently encrypted and carries its own master password. Each entry is
  decrypted under the backup's key and re-sealed under the current session key,
  then merged by id. This CPU-bound re-encrypt loop runs **off the UI thread** and
  emits `import:progress` events so the UI can show progress.

(The one automatic step, `ensure_migrated`, only *relocates* a legacy
Electron-era `vault.swftx` file into the new Tauri app-data directory; it does not
convert it into the encrypted database.)

## What Swifty defends against

- **Device theft / a lost or stolen laptop.** The vault is a local, SQLCipher-
  encrypted database; each entry's secrets carry an additional app-AEAD layer.
  Without the master passphrase (or a biometric unlock on that specific enrolled
  device) the contents are unreadable. The key is never persisted in plaintext,
  and auto-lock limits how long an unlocked session stays open.
- **Cloud-provider or sync compromise.** Sync is optional and, in `v1-0-0`,
  disabled (`sync::ENABLED = false`). When enabled it uploads only the already-
  encrypted vault blob to the user's own Google Drive; the master passphrase and
  derived keys never leave the device. A compromised Drive account or a tapped
  sync channel yields ciphertext, not secrets.
- **Remote server breach.** There is nothing central to breach. Swifty is
  offline-first with no account server, no telemetry, and no phone-home. The only
  outbound request at launch is the signed updater check to GitHub Releases; Drive
  sync (when enabled) runs from the Rust core over HTTPS, not from the webview.
- **Passive at-rest access and backups.** Because the database is SQLCipher-
  encrypted whole-file, file-level backups (Time Machine, disk images, cloud file
  backups) carry only ciphertext.
- **A tampered update.** Updater artifacts are minisign-signed and verified
  against the public key baked into `src-tauri/tauri.conf.json`; an unsigned or
  modified artifact is rejected. A signed update is downloaded and **staged** in
  the background and applied on the next launch — but the app does **not** relaunch
  silently. It surfaces a restart toast, and the update is applied only when the
  user consents to restart (or the next time they quit and reopen). This replaces
  the earlier silent-on-launch install.

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
- **Offline brute force at scale.** There is no failed-unlock throttling yet, so a
  stolen database can be attacked offline, bounded only by the KDF cost. That cost
  is the PBKDF2 parameters described above until Argon2id is wired into the live
  path.
- **The clipboard window.** Copied secrets go to the system clipboard. Swifty
  marks them as concealed and auto-clears after a timeout, but other apps can read
  the clipboard during that window.
- **Physical memory attacks.** Cold-boot or DMA attacks against an unlocked
  session are out of scope.

## Summary

Swifty's security rests on a SQLCipher-encrypted database, a second app-AEAD layer
that keeps each entry's secrets sealed until reveal, keys that are derived on
unlock, held only in the Rust process, and zeroized on lock, and the absence of
any server that could be breached. It assumes the user's device and operating
system are trustworthy while the vault is unlocked. It does not try to defend a
device that is already compromised. The move to Argon2id for live key derivation
is landing incrementally: the primitive and its versioned descriptor are merged,
and the live derivation path is being wired over from PBKDF2.
