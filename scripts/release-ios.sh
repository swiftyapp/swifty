#!/usr/bin/env bash
#
# Build the App Store IPA and upload it to App Store Connect (TestFlight) from
# this machine, in one command: `bun run release:ios`.
#
# This is the local twin of .github/workflows/release-ios.yml and uses the same
# App Store Connect API key, so signing is automatic (the key mints the Apple
# Distribution certificate and the App Store profile) and the upload needs no
# Apple ID password and no Xcode account. Setup: docs/releasing-ios.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "error: .env not found. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

set -a
source .env
set +a

require() {
  if [[ -z "${!1:-}" ]]; then
    echo "error: $1 is not set in .env — see docs/releasing-ios.md." >&2
    exit 1
  fi
}
require APPLE_API_ISSUER
require APPLE_API_KEY
require APPLE_API_KEY_PATH

# Expand a leading ~ so the .env value can be written the way it is typed.
APPLE_API_KEY_PATH="${APPLE_API_KEY_PATH/#\~/$HOME}"
if [[ ! -f $APPLE_API_KEY_PATH ]]; then
  echo "error: no API key at $APPLE_API_KEY_PATH (APPLE_API_KEY_PATH)." >&2
  exit 1
fi

# The marketing version (CFBundleShortVersionString) is derived from the config
# version by the Tauri CLI, which strips any prerelease tag and keeps exactly
# three integers — so the desktop's `1.0.0-alpha.1` ships to TestFlight as
# `1.0.0` with no iOS-specific config. Mirror that here for the log line only.
VERSION=$(bun -e 'console.log(require("./src-tauri/tauri.conf.json").version)')
SHORT_VERSION=$(bun -e 'const v = require("./src-tauri/tauri.conf.json").version
const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v)
console.log(m ? `${m[1]}.${m[2]}.${m[3]}` : v)')

# CFBundleVersion has to be strictly greater than every previous upload of this
# marketing version. Minutes since the epoch is monotonic, needs no state, and
# stays inside u32. Override for a specific number.
BUILD_NUMBER="${BUILD_NUMBER:-$(( $(date -u +%s) / 60 ))}"

# Set as the config value rather than with `tauri ios build --build-number`:
# that flag *appends* to the app version, producing a CFBundleVersion like
# `1.0.0.1.29822658`, and App Store Connect rejects anything longer than three
# period-separated integers (ITMS-90060). Setting it outright makes
# CFBundleVersion exactly the build number, which is a single integer.
BUNDLE_VERSION_CONFIG=$(bun -e "console.log(JSON.stringify(
  { bundle: { iOS: { bundleVersion: process.argv[1] } } }))" "$BUILD_NUMBER")

export APPLE_DEVELOPMENT_TEAM="${APPLE_TEAM_ID:-UFBL3F444A}"
export APPLE_API_KEY_PATH

# iOS OAuth clients are public and have no secret; the desktop client in .env is
# the wrong one for this bundle id. Both are read via option_env! at compile time.
if [[ -n ${GOOGLE_OAUTH_IOS_CLIENT_ID:-} ]]; then
  export GOOGLE_OAUTH_CLIENT_ID="$GOOGLE_OAUTH_IOS_CLIENT_ID"
  unset GOOGLE_OAUTH_CLIENT_SECRET
else
  echo "warning: GOOGLE_OAUTH_IOS_CLIENT_ID is not set — building without Drive sync." >&2
fi

# The OAuth redirect comes back to the app through the reversed client id, so a
# placeholder scheme here means the Drive login dead-ends on the device.
if grep -q YOUR_IOS_CLIENT_ID src-tauri/tauri.ios.conf.json; then
  echo "warning: the deep-link scheme in src-tauri/tauri.ios.conf.json is still a" >&2
  echo "         placeholder; Drive sign-in will not return to the app." >&2
fi

bun scripts/check-tauri-versions.mjs

rustup target add aarch64-apple-ios >/dev/null 2>&1 || true

if [[ ! -d src-tauri/gen/apple ]]; then
  echo "error: src-tauri/gen/apple is missing; run 'bun run tauri ios init'." >&2
  exit 1
fi

shopt -s nullglob

# Unlike the CI runner, this build directory survives between runs, so an IPA
# left by an earlier build — a previous productName, another target — would be
# a candidate below and could be uploaded in place of the build just made.
# Everything under build/ is generated and gitignored, so clearing it is free.
rm -f src-tauri/gen/apple/build/*.ipa src-tauri/gen/apple/build/*/*.ipa

echo "Building Swifty $SHORT_VERSION build $BUILD_NUMBER (config version $VERSION)…"
bun run tauri ios build --ci \
  --export-method app-store-connect \
  --config "$BUNDLE_VERSION_CONFIG"

ipas=(src-tauri/gen/apple/build/*.ipa src-tauri/gen/apple/build/*/*.ipa)
if [[ ${#ipas[@]} -eq 0 ]]; then
  echo "error: no .ipa under src-tauri/gen/apple/build." >&2
  exit 1
fi
# One target means one IPA. Several is ambiguous, and guessing risks uploading
# the wrong one, so say which were found instead of picking.
if [[ ${#ipas[@]} -gt 1 ]]; then
  echo "error: more than one .ipa after the build; not guessing which to upload:" >&2
  printf '  %s\n' "${ipas[@]}" >&2
  exit 1
fi
IPA="$PWD/${ipas[0]}"

# altool ignores APPLE_API_KEY_PATH and only looks for AuthKey_<id>.p8 inside a
# `private_keys` directory (cwd, $HOME, or API_PRIVATE_KEYS_DIR). Stage a copy
# in a temp dir that is removed on any exit, so no key is left lying around.
KEY_DIR=$(mktemp -d)
trap 'rm -rf "$KEY_DIR"' EXIT
mkdir -p "$KEY_DIR/private_keys"
cp "$APPLE_API_KEY_PATH" "$KEY_DIR/private_keys/AuthKey_$APPLE_API_KEY.p8"
chmod 600 "$KEY_DIR/private_keys/AuthKey_$APPLE_API_KEY.p8"

echo
echo "Uploading $(basename "$IPA") to App Store Connect…"
API_PRIVATE_KEYS_DIR="$KEY_DIR/private_keys" \
  xcrun altool --upload-app --type ios --file "$IPA" \
  --apiKey "$APPLE_API_KEY" --apiIssuer "$APPLE_API_ISSUER"

echo
echo "Done. Build $BUILD_NUMBER of $SHORT_VERSION is processing; it shows up under"
echo "TestFlight → iOS builds in roughly 5–30 minutes."
echo "  IPA: $IPA"
