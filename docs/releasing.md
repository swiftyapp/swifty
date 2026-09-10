# Releasing Swifty (desktop)

Swifty ships for macOS (signed + notarized universal build), Windows (NSIS
installer) and Linux (.deb, .rpm, AppImage) through GitHub Releases, with a
silent in-app auto-updater. This doc covers the one-time setup and the
per-release procedure. iOS is a separate workflow: see
[releasing-ios.md](releasing-ios.md).

## Overview

```
bump version → push a v* tag (or run Release manually) → CI builds all three platforms
            → DRAFT GitHub release (installers + .app.tar.gz + .sig + latest.json)
            → you review and publish the draft → installed apps update on next launch
```

- **Workflow:** `.github/workflows/release.yml`, one matrix job per platform.
- **macOS:** `universal-apple-darwin` (one binary for Apple Silicon + Intel),
  signed with the Developer ID Application cert (team `UFBL3F444A`), notarized
  and stapled by `tauri-apps/tauri-action`.
- **Windows:** NSIS `-setup.exe` only, not code-signed (no certificate). The
  MSI bundler is skipped while versions carry a pre-release suffix such as
  `1.0.0-alpha.1`; WiX only accepts numeric pre-release identifiers.
- **Linux:** `.deb`, `.rpm` and `.AppImage`, unsigned.
- **Update artifacts:** `createUpdaterArtifacts: true` in `tauri.conf.json`
  emits the platform-specific updater bundle plus a `.sig` made with the Swifty
  minisign key. `tauri-action` merges them into one `latest.json`, which the app
  fetches from `releases/latest/download/latest.json`.
- **Provenance + SBOM:** every installer gets a SLSA build-provenance
  attestation, and the Linux job attaches CycloneDX SBOMs to the release.

## One-time setup

### 1. Updater signing keypair

A minisign keypair signs every update artifact; the app verifies it with the
public key embedded in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).
The public key is committed. The private key lives outside the repo, for
example at `~/.tauri/swifty.key`. To regenerate:

```sh
bun run tauri signer generate -w ~/.tauri/swifty.key
```

Then put the new `~/.tauri/swifty.key.pub` contents into
`plugins.updater.pubkey`. **If you lose the private key, existing installs can
no longer auto-update** and need a fresh manual install.

### 2. GitHub repository secrets

Set these under **Settings → Secrets and variables → Actions**. The Apple and
Google names predate the Tauri port and are kept as-is; `release.yml` maps them
onto the env names the Tauri bundler expects.

| Secret | How to produce it |
| --- | --- |
| `CERTIFICATES_P12` | Export the **"Developer ID Application: Oleksandr Chaplinsky (UFBL3F444A)"** certificate *with its private key* from Keychain Access as a `.p12`, then `base64 -i cert.p12 \| pbcopy`. It must be this certificate: the bundler compares the `.p12` against the hard-coded `APPLE_SIGNING_IDENTITY` and aborts on a mismatch. An "Apple Development" or "Apple Distribution" cert cannot be notarized for direct download. |
| `CERTIFICATES_P12_PASSWORD` | The password you set when exporting the `.p12`. |
| `APPLE_ID` | Apple ID email of the developer account. |
| `APPLE_ID_PASSWORD` | An **app-specific password** (appleid.apple.com → Sign-In and Security → App-Specific Passwords). Not your account password. |
| `APPLE_TEAM_ID` | `UFBL3F444A`. |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/swifty.key`. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for that key (empty if generated without one). |
| `GOOGLE_OAUTH_CLIENT_ID` | Desktop-app OAuth client id from Google Cloud Console, baked in at compile time for Google Drive sync (`src-tauri/src/sync/auth.rs`). Unset → Drive sync reports "not configured". |
| `GOOGLE_OAUTH_CLIENT_SECRET` | The matching client secret. |

`APPLE_SIGNING_IDENTITY` is not a secret (it is the certificate's display
name) and is written directly in `release.yml`. If the certificate is ever
reissued under a different name, update it there and in `.env.example`.

### 3. Update endpoint

The repo is public, so the updater reads straight from GitHub Releases:

```json
"endpoints": ["https://github.com/swiftyapp/swifty/releases/latest/download/latest.json"]
```

`/releases/latest` only ever points at a **published, non-draft, non-prerelease**
release, so the updater sees a version only once you publish it. Integrity is
enforced by the minisign signature the app verifies against the embedded
pubkey.

## Per-release procedure

1. **Bump the version** in all three files (keep them identical):
   - `src-tauri/tauri.conf.json` → `version` (this is what the release tag and
     name are derived from, via `v__VERSION__`)
   - `package.json` → `version`
   - `src-tauri/Cargo.toml` → `version` (then `cargo update -p swifty
     --manifest-path src-tauri/Cargo.toml` so `Cargo.lock` follows)
2. Merge that to `main`. CI's supply-chain job must be green: it fails when a
   `@tauri-apps/*` npm package and its Rust crate are on different major.minor
   releases, which is exactly the check `tauri build` would otherwise fail on
   release day (`scripts/check-tauri-versions.mjs`).
3. Trigger the build, either way:
   - push a tag: `git tag v<version> && git push origin v<version>`
     (this also triggers the iOS release), or
   - GitHub → Actions → *Release* → *Run workflow* (only offered for the
     default branch).
4. Wait for all three platform jobs. They create one **draft** release
   `Swifty v<version>` with the installers, the updater artifacts, their
   `.sig` files, `latest.json` and the SBOMs. The Linux job replaces the
   placeholder body with GitHub's auto-generated release notes.
5. Review the draft and **Publish** it. Once published, installed apps pick it
   up on next launch.

## Local signed build (macOS)

To produce a signed + notarized universal build on your Mac without CI:

```sh
cp .env.example .env   # then fill in the values
./scripts/release-local.sh
```

Artifacts land in `src-tauri/target/universal-apple-darwin/release/bundle/`.
The Developer ID certificate must be in your login keychain; the script signs
with `APPLE_SIGNING_IDENTITY` from `.env` and does not need the `.p12`.

For an unsigned smoke build of just the app bundle (no DMG, no notarization),
any minisign key satisfies the updater-artifact step:

```sh
bun run tauri signer generate -w /tmp/test.key --ci
TAURI_SIGNING_PRIVATE_KEY="$(cat /tmp/test.key)" bun run tauri build --bundles app
```

## How the in-app updater behaves

`src/services/autoUpdate.ts` runs once at launch. It is a no-op in dev builds,
calls `check()`, and on an available update downloads, installs and relaunches.
Failures (offline, endpoint down) are logged and swallowed so they never block
startup. Required capabilities live in `src-tauri/capabilities/desktop.json`
(`updater:default`, `process:default`).

## Known limitations

- Windows installers are unsigned; SmartScreen will warn on first launch.
- `src-tauri/Entitlements.plist` requests `keychain-access-groups` with an
  `$(AppIdentifierPrefix)` placeholder. Tauri passes the file to `codesign`
  verbatim and does not expand Xcode-style variables, so the signed app may
  carry the literal string. The secure-store code falls back to the
  verify-then-read gate when the entitlement is not honoured; verify Touch ID
  enrolment on the first notarized build.
