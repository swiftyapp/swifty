# Releasing Swifty for iOS

The `.github/workflows/release-ios.yml` workflow builds the App Store IPA and
uploads it to App Store Connect, where it appears as a TestFlight build. There
is no updater plugin on iOS: the App Store is the update channel, so this
workflow produces no `latest.json` and no updater artifacts. Desktop releases
are a separate workflow (`.github/workflows/release.yml`).

App identity: bundle id `pro.getswifty.app`, team `UFBL3F444A`, minimum iOS
16.0.

## One-time setup

### 1. Apple Developer Program

A paid Apple Developer Program membership is required; a free account cannot
sign for distribution. The team id (`UFBL3F444A`) is the same one already used
for macOS notarization.

### 2. App Store Connect app record

In App Store Connect, **Apps → +  → New App**:

- Platform: iOS
- Bundle ID: `pro.getswifty.app` (register the App ID in the Developer portal
  first if it is not offered; no special capabilities are needed — Face ID
  requires only the usage string, not an entitlement)
- Name, primary language, SKU: free choice

The record must exist before the first upload; `altool` rejects an IPA whose
bundle id has no app record.

### 3. App Store Connect API key

**Users and Access → Integrations → App Store Connect API → Team Keys →
Generate API Key**:

- Access: **App Manager** (needed both to sign — the key lets Xcode create the
  Apple Distribution certificate and the App Store provisioning profile on the
  CI runner — and to upload builds)
- Download `AuthKey_<KEYID>.p8`. **It can only be downloaded once.** Keep a
  copy in a password manager.
- Note the **Issuer ID** (a UUID, shown above the key list) and the **Key ID**.

Because signing is automatic, no `.p12` certificate and no
`.mobileprovision` profile have to be exported or stored as secrets.

### 4. Google iOS OAuth client (Drive sync)

In the Google Cloud console for the existing Swifty project, **APIs & Services
→ Credentials → Create credentials → OAuth client ID → iOS**, with bundle id
`pro.getswifty.app`. iOS OAuth clients are public: there is **no client
secret**, and none must be set in CI. Copy the client id into the
`GOOGLE_OAUTH_IOS_CLIENT_ID` secret; the build maps it to the
`GOOGLE_OAUTH_CLIENT_ID` env var that `src-tauri/src/sync/auth.rs` reads at
compile time.

### 5. Repository secrets

Add under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `APPLE_API_ISSUER` | App Store Connect API **Issuer ID** (UUID) |
| `APPLE_API_KEY` | App Store Connect API **Key ID** (the `<KEYID>` in `AuthKey_<KEYID>.p8`) |
| `APPLE_API_KEY_P8` | base64 of the `AuthKey_<KEYID>.p8` file |
| `APPLE_TEAM_ID` | `UFBL3F444A` — **already set** for desktop notarization; reused here as `APPLE_DEVELOPMENT_TEAM` |
| `GOOGLE_OAUTH_IOS_CLIENT_ID` | Google iOS OAuth client id (no secret) |

Base64 the key file (macOS):

```sh
base64 -i ~/Downloads/AuthKey_ABC1234567.p8 | pbcopy
```

Line wrapping in the output is fine; the workflow's `base64 --decode` accepts
it. If `APPLE_TEAM_ID` is ever removed, the workflow falls back to the literal
`UFBL3F444A`, which matches `bundle.iOS.developmentTeam` in
`src-tauri/tauri.conf.json`.

## Per-release procedure

1. **Bump the version** in `src-tauri/tauri.conf.json`, `package.json` and
   `src-tauri/Cargo.toml` (they must stay in sync; the tag and the release name
   are derived from `tauri.conf.json`).

   App Store Connect requires `CFBundleShortVersionString` to be at most three
   dot-separated non-negative integers. A pre-release version such as
   `1.0.0-alpha.1` is fine for desktop but **will be rejected on upload**, so
   iOS releases must be cut from a plain `MAJOR.MINOR.PATCH` version.

2. **Tag and push**: `git tag v<version> && git push origin v<version>`. This
   triggers both `Release` (desktop) and `Release iOS`. The iOS workflow can
   also be started manually from the Actions tab (`workflow_dispatch`) — GitHub
   only offers that for workflows on the default branch.

3. **Watch the run.** `CFBundleVersion` is set to the workflow run number
   (`--build-number`), which is strictly increasing, so re-running the workflow
   for the same version always produces an acceptable new build.

4. **TestFlight processing** takes roughly 5–30 minutes after the upload step
   succeeds. The build then appears under **TestFlight → iOS builds**. The IPA
   is always kept as the `swifty-ios-ipa` workflow artifact — including when
   App Store Connect rejects the upload — and is also attached to the draft
   GitHub release for the tag (created by the desktop workflow).

   A tag run attaches to the tag that triggered it. A manual run builds the
   default branch, which may be ahead of the released version, so it attaches
   to `v<version from tauri.conf.json>` only when that release does not already
   carry an IPA; otherwise it logs a warning and leaves the existing asset
   alone. To replace the IPA on a release, re-run the workflow by pushing (or
   re-pushing) that tag.

5. **Export compliance** must be answered for the build — see below. Until it
   is answered the build stays in "Missing Compliance" and cannot be
   distributed to testers.

6. **App Store submission**: **Apps → Swifty → iOS App → + Version**, fill in
   what's new, screenshots and the review notes (include test-vault credentials
   if the reviewer needs them), select the processed build, then **Add for
   Review → Submit**.

## Export compliance

Swifty encrypts the user's vault with standard, published algorithms:
AES-256-GCM, Argon2id and SQLCipher. That is **not** an exemption. The common
`ITSAppUsesNonExemptEncryption = false` shortcut is wrong for this app and must
**not** be added to `Info.ios.plist`.

Answer the App Store Connect questionnaire as:

- Does your app use encryption? **Yes.**
- Does it qualify for any of the listed exemptions? **No.** The exemptions
  cover apps that only use the encryption built into Apple's OS, only make
  HTTPS calls, or only use encryption for authentication or DRM. Swifty ships
  its own cryptography for user data at rest, so none of them apply.
- Which algorithms? **Standard encryption algorithms instead of, or in addition
  to, using or accessing the encryption in Apple's operating system** — i.e.
  standard published algorithms, no proprietary or non-standard cryptography.

This classification (mass-market software using standard algorithms) requires
an **annual self-classification report to the US Bureau of Industry and
Security (BIS) and the ENC Encryption Request Coordinator**, filed by 1
February each year for the previous calendar year. See
<https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations>.

## App Store privacy nutrition labels

Under **App Privacy**, declare **Data Not Collected**:

- The vault is local to the device; nothing is sent to a Swifty-operated
  server (there is none).
- Drive sync uploads the *encrypted* vault to the user's **own** Google
  account, chosen by the user. It is not collected by the developer and is not
  linked to the user by us.
- No analytics, no crash reporting, no advertising identifiers, no third-party
  SDKs that collect data.

The only user-facing permission is biometrics: the `NSFaceIDUsageDescription`
string in `src-tauri/Info.ios.plist` (Face ID / Touch ID is used to unlock the
local vault). Face ID usage does not itself require a privacy label entry, as
no biometric data leaves the device or reaches the app.

## Troubleshooting

- **"No suitable application records were found"** — the App Store Connect app
  record for `pro.getswifty.app` does not exist yet (step 2).
- **Invalid `CFBundleShortVersionString`** — the version has a pre-release
  suffix; see step 1 of the release procedure.
- **`src-tauri/gen/apple is missing`** — the Xcode project is committed to the
  repo; regenerate it locally with `bun run tauri ios init` and commit.
- **Signing failures** — usually an API key without the App Manager role, or a
  key that was revoked; generate a new one and update `APPLE_API_KEY`,
  `APPLE_API_ISSUER` and `APPLE_API_KEY_P8` together.
