#!/usr/bin/env bash
#
# Build a signed + notarized universal macOS release locally.
#
# Reads signing/notarization config from .env (copy .env.example → .env first).
# Produces a signed .dmg and the updater artifacts (.app.tar.gz + .sig) under
# src-tauri/target/universal-apple-darwin/release/bundle/.
#
# This mirrors the macOS leg of the Release GitHub Actions workflow
# (.github/workflows/release.yml) for local builds. See docs/releasing.md.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "error: .env not found. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

# Load .env (allows command substitution like TAURI_SIGNING_PRIVATE_KEY="$(cat ...)").
set -a
# shellcheck disable=SC1091
source .env
set +a

# Same npm/crate agreement check the release build enforces, but fails fast.
bun scripts/check-tauri-versions.mjs

# Ensure both arch targets exist for the universal lipo.
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true

echo "Building signed + notarized universal macOS app…"
bun run tauri build --target universal-apple-darwin

echo
echo "Done. Artifacts:"
echo "  src-tauri/target/universal-apple-darwin/release/bundle/"
