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

# App Store Connect only accepts up to three dot-separated integers as
# CFBundleShortVersionString, so a pre-release version is rejected on upload —
# after a full release build. Fail in the first second instead.
VERSION=$(bun -e 'console.log(require("./src-tauri/tauri.conf.json").version)')
if [[ ! $VERSION =~ ^[0-9]+(\.[0-9]+){0,2}$ ]]; then
  echo "error: version $VERSION is not MAJOR.MINOR.PATCH; App Store Connect" >&2
  echo "       rejects pre-release versions. Bump src-tauri/tauri.conf.json," >&2
  echo "       package.json and src-tauri/Cargo.toml first." >&2
  exit 1
fi

# CFBundleVersion has to be strictly greater than every previous upload of this
# version string. Minutes since the epoch is monotonic, needs no state, and
# stays well inside the 32-bit component limit. Override for a specific number.
BUILD_NUMBER="${BUILD_NUMBER:-$(( $(date -u +%s) / 60 ))}"

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

echo "Building Swifty $VERSION ($BUILD_NUMBER) for the App Store…"
bun run tauri ios build --ci \
  --export-method app-store-connect \
  --build-number "$BUILD_NUMBER"

shopt -s nullglob
ipas=(src-tauri/gen/apple/build/*.ipa src-tauri/gen/apple/build/*/*.ipa)
if [[ ${#ipas[@]} -eq 0 ]]; then
  echo "error: no .ipa under src-tauri/gen/apple/build." >&2
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
echo "Done. Build $BUILD_NUMBER of $VERSION is processing; it shows up under"
echo "TestFlight → iOS builds in roughly 5–30 minutes."
echo "  IPA: $IPA"
