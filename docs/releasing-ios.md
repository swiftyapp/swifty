# Releasing Swifty for iOS

The `.github/workflows/release-ios.yml` workflow builds the App Store IPA and
uploads it to App Store Connect, where it appears as a TestFlight build. There
is no updater plugin on iOS: the App Store is the update channel, so this
workflow produces no `latest.json` and no updater artifacts. Desktop releases
are a separate workflow (`.github/workflows/release.yml`).

App identity: bundle id `app.rowel.mobile`, team `UFBL3F444A`, minimum iOS
16.0.

iOS has its **own** bundle id. `identifier` in `src-tauri/tauri.conf.json` stays
`pro.getswifty.app` for desktop, and `src-tauri/tauri.ios.conf.json` overrides
it for iOS builds only — Tauri merges the platform config over the base one
(RFC 7396), and `tauri ios build` writes the merged value into the Xcode
project's `PRODUCT_BUNDLE_IDENTIFIER` on every build. Everything below that
names a bundle id means the iOS one.

## One-time setup

### 1. Apple Developer Program

A paid Apple Developer Program membership is required; a free account cannot
sign for distribution. The team id (`UFBL3F444A`) is the same one already used
for macOS notarization.

### 2. App Store Connect app record

In App Store Connect, **Apps → +  → New App**:

- Platform: iOS
- Bundle ID: `app.rowel.mobile` (register the App ID in the Developer portal
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
`app.rowel.mobile`. iOS OAuth clients are public: there is **no client
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

## Releasing from your Mac

`bun run release:ios` (`scripts/release-ios.sh`) does the whole thing in one
command: it builds the App Store IPA and uploads it to App Store Connect, where
it becomes a TestFlight build. It is the local twin of the workflow above and
uses the same App Store Connect API key, so signing is automatic and there is
no Apple ID password and no Xcode account involved.

One-time, per machine:

```sh
xcode-select --install                 # or a full Xcode from the App Store
sudo xcodebuild -license accept
rustup target add aarch64-apple-ios
brew install cocoapods                 # `tauri ios build` runs `pod install`
bun install
```

Then put the same values CI uses into `.env` (see `.env.example`):
`APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` (path to your
`AuthKey_<KEYID>.p8`, kept outside the repo) and `GOOGLE_OAUTH_IOS_CLIENT_ID`.
`APPLE_TEAM_ID` is already there for desktop notarization and is reused.

```sh
bun run release:ios
```

The script derives `CFBundleVersion` from the clock — minutes since the epoch,
so it always increases — and stages the API key in a temp directory that is
deleted on exit. Pass `BUILD_NUMBER=<n>` to set the build number yourself.

It sets the build number through `--config bundle.iOS.bundleVersion` rather
than through `tauri ios build --build-number`, because that flag *appends* to
the app version: with the version below it would produce a `CFBundleVersion` of
`1.0.0.1.29822658`, and App Store Connect rejects anything longer than three
period-separated integers (ITMS-90060). Set outright, `CFBundleVersion` is just
the build number.

Local and CI build numbers come from different sequences: the workflow uses the
GitHub run number, which is much smaller than a timestamp. Once a local build
of a version has been uploaded, CI cannot upload that same version any more
(its build number would not be strictly greater). Use one or the other per
version, or pass `BUILD_NUMBER` explicitly.

`bun run ios:init` and `bun run ios:dev` wrap `tauri ios init` / `tauri ios dev`
for the rare case where the committed Xcode project has to be regenerated or
you want the app on a connected device.

## Per-release procedure

1. **Bump the version** in `src-tauri/tauri.conf.json`, `package.json` and
   `src-tauri/Cargo.toml` (they must stay in sync; the tag and the release name
   are derived from `tauri.conf.json`).

   A pre-release version needs no special handling: App Store Connect requires
   `CFBundleShortVersionString` to be exactly three dot-separated non-negative
   integers, and the Tauri CLI already strips the prerelease tag on the way
   into the Xcode project (with a warning). The desktop's `1.0.0-alpha.1` ships
   to TestFlight as marketing version `1.0.0`, so desktop and iOS can stay on
   one version string. What distinguishes successive alpha uploads under that
   one marketing version is `CFBundleVersion`, which the release script sets
   per build.

2. **Tag and push**: `git tag v<version> && git push origin v<version>`. This
   triggers both `Release` (desktop) and `Release iOS`. The iOS workflow can
   also be started manually from the Actions tab (`workflow_dispatch`) — GitHub
   only offers that for workflows on the default branch.

3. **Watch the run.** `CFBundleVersion` is set to the workflow run number
   (through `--config bundle.iOS.bundleVersion`, for the ITMS-90060 reason
   above), which is strictly increasing, so re-running the workflow for the
   same version always produces an acceptable new build.

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
  record for `app.rowel.mobile` does not exist yet (step 2).
- **ITMS-90060 / invalid `CFBundleVersion`** — the build version came out with
  more than three period-separated integers, which happens when the build
  number is appended to the app version instead of replacing it; see step 1 of
  the release procedure.
- **`src-tauri/gen/apple is missing`** — the Xcode project is committed to the
  repo; regenerate it locally with `bun run tauri ios init` and commit.
- **Signing failures** — usually an API key without the App Manager role, or a
  key that was revoked; generate a new one and update `APPLE_API_KEY`,
  `APPLE_API_ISSUER` and `APPLE_API_KEY_P8` together.
