# Swifty v1-0-0 — Audit Remediation Checklist

Systemic remediation plan for `v1-0-0`, derived from the legacy Electron audit (`swifty-audit.md`)
**re-verified against the actual Tauri 2 code**. Every legacy finding was checked in the current
tree; this document keeps only what is still real, maps each Electron-era concern to its Tauri
equivalent, and specifies the industry-standard fix — not a like-for-like patch.

**Goal:** land all of this inside `v1-0-0` (before the 1.0 release), not after.

## How to use this doc

- Each task is a self-contained unit: scope, files, concrete steps, and an **acceptance gate** a
  subagent can verify. Hand an agent one task at a time.
- Standing code style: simplest thing that works, DRY, short implementations, minimal comments.
- Every task's definition of done includes the repo gates staying green:
  `bun run typecheck` · `bun run lint` (0 warnings) · `bun run test` · `cargo test` + `cargo clippy -D warnings`.
- 🔴 **OWNER-REVIEW** = do not accept the diff unmachined; the repo owner reviews personally
  (storage engine, crypto/KDF, sync algorithm, keychain, migration).

## Status legend

| Mark | Meaning |
|---|---|
| ✅ | Resolved by the Tauri port — **do not regress** |
| 🟡 | Partial — better than legacy but below the 2025 bar |
| ❌ | Open — still present in `v1-0-0` |
| ⚪ | N/A — Electron-specific, no analog in Tauri |

---

## 0. Banked wins — verified resolved (regression guard only)

The rewrite structurally erased a large share of the audit. These are **done**; the only task is
not to reintroduce them. No work item unless a later change touches them.

- ✅ **S1** arbitrary-IPC dispatch → commands are a fixed enumerated `generate_handler!` list (`lib.rs:55-79`); window ops scoped to `main` only (`capabilities/default.json`).
- ✅ **S10** audit hashes crossing IPC → audit returns **booleans only**; decrypt + repeat-detection stay inside a Rust `spawn_blocking` (`commands/audit.rs`).
- ✅ **S16** crash-reporter secret leak → no panic hook / dialog-on-error path; errors serialize to generic strings (`error.rs:36-44`).
- ✅ **S18** analytics → none anywhere (no package, no code). Keep it that way.
- ✅ **S19** phone-home DNS probe → none; only network at launch is the **signed** updater.
- ✅ **S14** macOS `allow-unsigned-executable-memory` / MAS mismatch → no entitlements file, no MAS target (`bundle.targets: "all"`).
- ✅ **D5/D6/D7** blind-write / dead branch / ignored merge arg → type-safe, error-propagating command paths.
- ✅ **B1** search regex crash → `String.includes`, not `.match` (`services/entries.ts:44`).
- ✅ **B4** `verifyOTP` undefined → returns `Result<bool>` end-to-end (`commands/generator.rs:88-92`).
- ✅ **B6** hooks after early return → all hooks precede the guard (`MasterPassword.tsx`).
- ✅ **B7** IPC listener leak → single `subscribeToEvents` registered once with cleanup (`store/events.ts`, `App.tsx`).
- ✅ **B11** deprecated `shortid` → `crypto.randomUUID()`.
- ✅ **C2/C3** CI matrix no-op / deprecated actions → OS matrix wired correctly, `checkout@v4`/`setup-node@v4`.
- ✅ **C5/T21** stale runtime / `speakeasy` → Electron gone; `speakeasy`→`totp-rs 5.7.2`; crates current.

---

## Phase 1 — Storage engine: SQLite + app-level encryption 🔴 OWNER-REVIEW (highest priority)

**Decision:** replace the single encrypted JSON vault with a **SQLite** database — the industry-standard
durable, structured local store (the 1Password model). Secrets stay **application-encrypted AEAD
blobs** (decrypt-on-reveal preserved); non-secret metadata lives in queryable columns; the whole DB
is wrapped in **SQLCipher** so metadata is also encrypted at rest. This one architecture resolves
durability (D1/S7/T4), the per-save whole-file rewrite (T7), sync tombstones/timestamps (D2–D4), and
structured search (B2). Rust: `rusqlite` with `bundled-sqlcipher` (compiled from source, cross-platform).

> ⚠️ **SQLCipher is a native dependency.** In the combo it does *not* carry the "all plaintext in
> memory" downside of transparent-only encryption — secret fields remain app-encrypted even in the
> open DB's page cache; only metadata columns are exposed while unlocked. If deferred, the fallback
> is plain SQLite and metadata columns sit in cleartext at rest (titles/tags/sites leak which
> accounts exist). **Recommended: keep SQLCipher.**

Target schema:
```
meta(key TEXT PRIMARY KEY, value TEXT)          -- schema_version, kdf, kdf_params, salt
entries(
  id TEXT PRIMARY KEY,
  type TEXT, title TEXT, tags TEXT, url_host TEXT,             -- queryable metadata
  created_at INTEGER, updated_at INTEGER, deleted_at INTEGER,  -- LWW + tombstone
  payload BLOB                                                 -- AEAD(username, password, website, notes, card, otp)
)
```

### T-STORE-1 · Introduce the SQLite storage engine  ✅ (integrated — app persists through `VaultStore`; per-row upsert/tombstone, `save_entry`/`delete_entry`/`reveal_entry`; SQLCipher key = HKDF subkey of the session secret; schema versioned via `rusqlite_migration`/`user_version`) (D1, S7, T4, T7)
**Evidence:** `storage.rs:46-52` plain `fs::write` (non-atomic, no fsync/`.bak`, 0644); the whole `VaultData` is re-serialized and rewritten on every save (`commands/vault.rs:42-43`).
**Steps:**
1. Add `rusqlite` (`bundled-sqlcipher`). Open the DB in WAL mode, keyed via `PRAGMA key` from the derived vault key.
2. Create the `meta` + `entries` schema above. Secret fields → one AEAD `payload` blob (existing AES-256-GCM primitive, unchanged); metadata (type/title/tags/url_host/timestamps) → columns.
3. Per-entry read/write/delete = single-row statements in a transaction — no whole-store rewrite. A delete sets `deleted_at` (tombstone), it does not drop the row.
4. File mode `0600`, dir `0700` at create.
**Acceptance:** CRUD works per-row; a process kill mid-write leaves the DB intact (ACID/WAL); the DB file is `0600`; opening without the key fails; inspecting the raw DB shows no plaintext secret field.

### T-STORE-2 · Import existing `.swftx` vaults on demand (fresh-start default)  ✅ (integrated — v1.0.0 starts fresh with an empty SQLite vault; `is_initialized` keys off the DB only, `unlock`/`unlock_biometric` never migrate and run the SQLCipher open off the UI thread; the migration capability is exposed as an explicit, async **Import from .swftx** — `import_swftx` re-keys each entry under the current session key inside `spawn_blocking`, emits `import:progress`, and upserts by id; wrong source password errors; round-trip + wrong-password tests green)
**Evidence:** real users hold a `vault.swftx` JSON blob. The byte-compat golden harness (`crypto/tests.rs` + `crypto/fixtures.json`) tests the **crypto primitive, not the container**, so switching containers is safe as long as legacy decrypt keeps working.
**Steps:**
1. Fresh start: a legacy `vault.swftx` alone does NOT count as initialized — the app shows Setup and creates a new empty encrypted DB. Unlock is derive-key + open-DB + list metadata only, no crypto loop.
2. Import stays a user-triggered action: pick a `.swftx`, supply the source vault's master password (may differ from the current one), decrypt off-thread, re-obscure each entry under the current session cryptor, upsert by id, emit progress; the source file is never deleted.
3. Tests: re-key-across-passwords round-trip (source `.swftx` → current-keyed store → identical plaintext out) and a wrong-source-password error case.
**Acceptance:** unlock never freezes (no per-entry PBKDF2 on the main thread); a `.swftx` under any password imports into the open vault with a visible progress state; a wrong source password shows a clear error; all golden fixtures stay green.

### T-STORE-3 · Surface save failures in the UI  ✅ (integrated — `Form/index.tsx` and `Show/index.tsx` `.catch` the save/delete thunks into an inline `<Error>`; a failed write never mutates the list as saved) (D5 remainder)
**Evidence:** save thunks are `await`ed but call sites (`Form/index.tsx`, `Show/index.tsx`) dispatch without `.catch`, so a failed write is an unhandled rejection, not a visible error.
**Steps:** add error handling on the save/delete paths → user-visible toast/inline error; never imply success on a failed write.
**Acceptance:** a forced write failure shows a visible error and does not mutate displayed state as if saved.

---

## Phase 2 — KDF hardening 🔴 OWNER-REVIEW (S6, T11)

KDF descriptor + params live in the `meta` table (from T-STORE-1), so upgrading the KDF is a metadata
change, not an on-disk-format break. **Never break legacy-vault decrypt** (golden harness).

### T-KDF-1 · Argon2id with params in `meta`, drop the pre-hash  ✅ 🔴 (wired — setup/unlock derive the master via Argon2id from a plaintext `vault.kdf.json` sidecar (salt+params, read before opening), HKDF-split into the SQLCipher key + a per-entry AES-256-GCM payload key; password fed directly to Argon2id (no `hash_secret`); descriptor mirrored into `meta`; sidecar-less dev DBs fall back to the legacy deterministic key; change-password rewrites the sidecar + re-seals + rekeys; `.swftx` reads keep the legacy PBKDF2 `Cryptor` + golden/crosscheck harness)
**Evidence:** `crypto/mod.rs:28` PBKDF2-SHA512 @ 100k (below OWASP ~210k); `crypto/mod.rs:31-34` `hash_secret` = `base64(SHA512(pw))` adds no entropy and feeds the KDF at every call site.
**Steps:**
1. Add Argon2id (`argon2`, ~`m=64MiB, t=3, p=4`) as the default for new/migrated DBs; store `{ kdf, params, salt }` in `meta`. Keep PBKDF2-SHA512 as a configurable fallback.
2. Feed the password directly to the KDF for new DBs — drop `hash_secret` (legacy JSON decrypt keeps it during T-STORE-2 migration only).
3. Derive the app payload key and the SQLCipher key as separate subkeys of the Argon2id output (HKDF), so one KDF pass yields both.
**Acceptance:** new DBs use Argon2id per `meta`; migrated legacy vaults still open; cross-impl/golden suites green; a KDF-params round-trip test exists.
> **Progress (primitive done):** The self-contained KDF primitive lands in the `crypto: Argon2id KDF primitive` PR — `crypto/kdf.rs` with the versioned `KdfParams` descriptor (`argo`/`m_cost`/`t_cost`/`p_cost`/`iterations`/`salt`, JSON string for `meta`), `derive()` dispatch (Argon2id default `m=64MiB, t=3, p=4` / PBKDF2-SHA512 fallback), a fresh-salt generator, and in-module tests (determinism, serde round-trip, dispatch, Argon2id KAT). Legacy PBKDF2 `Cryptor` + golden/crosscheck harness untouched. **Wiring is pending** and is a follow-up after the storage rework (#246) lands: persist `KdfParams` in `meta` at setup, read it at unlock, feed the master password directly to `derive()`, and HKDF-split the output into the SQLCipher + payload subkeys. This task stays ❌ until that wiring ships.

---

## Phase 3 — Sync on the new schema 🔴 OWNER-REVIEW (D2–D4, S13, T6, T20)

Sync is **disabled** behind `sync::ENABLED = false`, but the merge bugs are compiled and unit-tested
as *expected* behavior — they would corrupt vaults the moment it flips on. The SQLite schema already
carries `updated_at` + `deleted_at`, so the redesign becomes essentially "diff two tables." Depends
on Phase 1.

### T-SYNC-1 · Per-row LWW + tombstones (replace whole-vault merge)  ❌ 🔴 (D2, D3, D4)
**Evidence:** `sync/merge.rs:39-49` drops rows absent from the winning side (delete-on-absence, no tombstones); `merge.rs:64-71` index-merges arrays (tags corrupt); `merge.rs:89-93` compares a vault-level timestamp, and no per-entry `updated_at` is ever set (`commands/vault.rs:42`).
**Steps:**
1. Merge **per row** on `updated_at` (last-writer-wins); a delete is a `deleted_at` tombstone — **absence is never deletion**.
2. **Union** tag sets by value; no positional array merge.
3. `updated_at` is stamped on every write (native to T-STORE-1).
**Acceptance:** two DBs each holding a row the other lacks → both retained; concurrent edit → newer `updated_at` wins; a delete propagates via tombstone; tags union. Add a 3-device concurrent-edit property test.

### T-SYNC-2 · Deterministic Drive-folder handling  ❌ (S13 remainder)
**Evidence:** query escaping is already fixed (`sync/drive.rs:21-23` `escape()`, tested), but `find_one()` (`drive.rs:38-52`) still takes `files.first()` unconditionally.
**Steps:** when multiple "Swifty" folders match, resolve deterministically (error, or pick oldest) instead of blind `[0]`.
**Acceptance:** a two-folder fixture no longer yields nondeterministic sync.

---

## Phase 4 — Auth & memory hardening (parallelizable)

### T-AUTH-1 · Remove the master-password length cap  ✅ (PR) (S5)
**Evidence:** `Masterpass.tsx:35` `maxLength={24}` on both unlock and setup. **Steps:** remove it. **Acceptance:** a 40-char passphrase sets and unlocks.

### T-AUTH-2 · Setup strength requirement  ✅ (PR) (S9, T12)
**Evidence:** `Setup/Enter.tsx:21-24` only checks non-empty. **Steps:** add a zxcvbn meter + enforce ≥12 chars before `onEnter`. **Acceptance:** weak/short passwords are blocked with feedback.

### T-AUTH-3 · Failed-unlock backoff  ❌ (S8, T12)
**Evidence:** `commands/auth.rs:27-46` derives+tests immediately; no counter anywhere. **Steps:** persisted attempt counter (survives restart — store in the DB `meta` table) with exponential delay after 3 free attempts. **Acceptance:** repeated wrong attempts incur growing delay that survives a process kill.

### T-MEM-1 · Zeroize the key on lock/drop  ✅ (PR) (S4, T10)
**Evidence:** auto-lock is real (`state.rs:38-42` `clear()` drops key+vault; `autolock.rs:41-50` 60s), but `master_key` is a plain `Vec<u8>` (`state.rs:13`) — drop doesn't scrub the heap; no `zeroize` dep.
**Steps:** wrap `master_key` and `Cryptor::secret` in `zeroize::Zeroizing` / `secrecy::SecretVec`; scrub on drop and on `clear()`. Keep the existing auto-lock + explicit-lock design (structurally correct). Optionally back biometric unlock with an OS-keychain-stored key (`kSecAccessControlBiometryCurrentSet`) rather than the in-session key.
**Acceptance:** a test asserts no plaintext key remains reachable after lock; key type zeroizes on drop.

---

## Phase 5 — Webview & shell hardening (parallelizable)

### T-SEC-1 · Set a strict CSP  ✅ (PR) (S15, T14) — high priority
**Evidence:** `tauri.conf.json:29` `security.csp: null` — **no CSP at all** (worse than legacy's late meta CSP). **Steps:** set an explicit main-process CSP, e.g. `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-src 'none'` (add Google sync origins to `connect-src` **only** if/when sync is enabled). **Acceptance:** CSP present; app runs; no console CSP violations.

### T-SEC-2 · Scope external-link opening to http/https  ✅ (PR) (S2, T8)
**Evidence:** `Show/.../Item/index.tsx:26-29` calls `openUrl(raw)` on the raw vault `website` field; `capabilities/default.json:17` grants **unscoped** `opener:allow-open-url`. **Steps:** validate scheme (`http:`/`https:` only) before `openUrl`, and replace the unscoped permission with `opener:allow-default-urls` or a scoped custom permission. **Acceptance:** a `file://`/custom-scheme website value is refused; http/https still opens.

### T-SEC-3 · Log-redaction discipline  ✅ (PR) (S17)
**Evidence:** only 2 benign `log::` sites today; no structural redaction; unused frontend `plugin-log`. **Steps:** add a lint/review rule forbidding `log::*!` interpolating `Entry`/secret fields; drop the unused frontend log plugin or wire redaction. **Acceptance:** rule in place; no secret-bearing log call exists.

### T-SEC-4 · Prompt before auto-installing updates  ✅ (PR) (updater UX)
**Evidence:** `updater.rs:15-20` silently downloads+installs on launch (`lib.rs:52`); signed via minisign (`tauri.conf.json:57`, public key — not a leak). **Steps:** surface an update prompt/notice before install (silent self-update is a trust concern even when signed). **Acceptance:** update requires user consent (or is clearly disclosed + opt-out).

---

## Phase 6 — Audit quality & product correctness

### T-AUDIT-1 · Modern password audit  ✅ (PR) (B8, T13)
**Evidence:** `commands/audit.rs:8-9,47-53` uses composition rules (upper+lower+digit+symbol — NIST-discredited) + `FRESHNESS_DAYS = 90` rotation; no breach check. **Steps:** replace composition rules with a zxcvbn score; drop the rotation check; add **opt-in** HIBP Pwned-Passwords via k-anonymity (first 5 SHA-1 chars only, clearly explained in UI). Keep the boolean/score-only IPC contract. **Acceptance:** a strong passphrase is not "weak"; HIBP lookup is opt-in and never sends a full hash.

### T-PROD-1 · Small correctness batch  ✅ (PR) (B2, B5, B9)
**Evidence:** `services/entries.ts:43-44` search is title-only; `:13` card save requires `pin`; `defaults/generator.ts:4` length 12. **Steps:** extend search to username/website/tags/notes (query metadata columns + bounded decrypt-on-demand for secret fields; optional `fuse.js` ranker, T16); drop the `pin` requirement for cards; raise generator default to 20. **Acceptance:** search matches non-title fields; a card saves without a PIN; new generated passwords are 20 chars.

### T-PROD-2 · Clipboard hygiene  ✅ (PR) (B10, T19)
**Evidence:** `clipboard.rs:12-17` clears unconditionally; no concealed-type marker; `services/copy.ts:3` 60s. **Steps:** clear **only if** the clipboard still holds the value written (compare-then-clear); set `org.nspasteboard.ConcealedType` (macOS) / `ExcludeClipboardContentFromMonitorProcessing` (Windows); drop default to 20s, make configurable. **Acceptance:** clearing never wipes an unrelated later copy; clipboard managers skip the secret.

---

## Phase 7 — Import/export (real feature, independent)

### T-IMPORT-1 · Import/export pipeline  ✅ (PR) (B3, T17)
**Evidence:** only self-backup restore exists (`import_backup` decrypts a `.swftx`); zero third-party format support. **Steps:** add an import command that parses Bitwarden JSON, 1Password `.1pux`/CSV, LastPass CSV, KeePass CSV/XML, Chrome/Safari CSV, generic CSV with column mapping, and writes rows into the DB; preview-and-confirm, **per-row** error handling (no throw-on-first), dry-run count; matching export in the same formats. **Acceptance:** each format imports via a fixture; one malformed row doesn't abort the batch; round-trip export re-imports.

> Highest adoption-impact item. No dependency on the security work — can run any time after Phase 1.

---

## Phase 8 — Supply chain, CI assurance & docs

### T-CI-1 · Supply-chain gates  ✅ (PR) (C4, T3)
**Steps:** add blocking CI steps `cargo audit` + `cargo-deny` and `bun audit` (or `npm audit --audit-level=high`); add a **CodeQL** workflow (JS + Rust); add `.github/dependabot.yml` covering **npm (root) + cargo (src-tauri) + github-actions**, targeting `v1-0-0`; unpause repo automated security fixes; enable secret scanning. **Acceptance:** CI fails on a known-vuln dependency; Dependabot opens PRs across all three ecosystems.

### T-CI-2 · E2E smoke suite  ❌ (C1, T1)
**Steps:** add `tauri-driver` + WebdriverIO covering unlock → add/edit/delete entry → lock → export; wire into CI. **Acceptance:** the smoke suite runs the built app in CI and fails on a broken flow.

### T-CI-3 · Vault-corruption regression suite  ❌ (T2) — after T-STORE-1 / T-SYNC-1
**Steps:** the three audit tests, adapted to SQLite — crash-mid-write leaves a valid DB; two-DB non-destructive merge; `updated_at` round-trip. **Acceptance:** all three pass on the fixed code and fail if the fix is reverted.

### T-CI-4 · Build attestation & reproducibility  ✅ (PR) (C6, T22)
**Evidence:** signing exists (notarization + Windows cert + minisign updater) but no provenance. **Steps:** add `actions/attest-build-provenance` (OIDC/SLSA) to `release.yml`; add CycloneDX SBOM to release assets; pin `rust-toolchain.toml` + the bun version; document verification in the README. **Acceptance:** releases carry provenance + SBOM; a documented verify procedure exists.

### T-DOC-1 · SECURITY.md  ✅ (PR) (T23)
Supported versions, contact, response-time SLA, disclosure policy. **Acceptance:** file present, non-template.

### T-DOC-2 · Threat model  ✅ (PR) (T24)
One page: defends against device theft / cloud-provider compromise / remote breach; explicitly **not** compromised OS / keylogger / local root; key lifecycle across the Tauri process split. **Acceptance:** published under `docs/`.

---

## Already fixed this cycle (not in the audit)

- ✅ **CI on bun** (PR #236) — PR #234 moved the repo to bun but left `ci.yml` on `npm ci`; migrated all jobs to `oven-sh/setup-bun` + `bun install --frozen-lockfile`.
- ✅ **Dev-data isolation** — debug builds use `app_data_dir/dev` so `tauri:dev` never touches the real vault.

## Minor / cleanup

- **Sass `darken()` deprecation** (pre-existing, non-fatal): removed in Dart Sass 3.0. Migrate to `color.adjust`/`color.scale` + `@use`, or fold into the planned styling redesign. Not blocking.

---

## Suggested execution order

```
Phase 1 (storage: SQLite) 🔴  ── foundational; do first, unblocks 2 & 3
   ├─ Phase 2 (KDF on meta) 🔴 ── needs the schema/meta table
   └─ Phase 3 (sync) 🔴         ── needs updated_at / deleted_at columns
Phase 4 (auth/mem)      ┐
Phase 5 (webview)       ├─ parallel, independent of 1-3
Phase 6 (audit/product)┘
Phase 7 (import)              ── independent, any time after Phase 1 (import writes rows)
Phase 8 (CI/docs)            ── T-CI-1/2 early (safety net); T-CI-3 after 1 & 3
```

🔴 OWNER-REVIEW tasks (Phases 1–3, T-MEM-1): review the diffs personally — storage engine, JSON→DB
migration, KDF, sync algorithm, keychain. Everything else is safe to delegate with the per-task
acceptance gate as the guardrail.
