#!/usr/bin/env bash
#
# Fails unless the IPA registers exactly the URL scheme the build was given.
#
#   scripts/check-ipa-url-schemes.sh <path.ipa> [<scheme>]
#
# No scheme means the app must register none. The scheme is Google's reversed
# iOS OAuth client id (README, "Drive sync on iOS"); it lands in Info.plist
# through tauri-plugin-deep-link's build script, which cargo can skip when it
# thinks it is up-to-date, leaving whatever the committed Info.plist held. A
# wrong or placeholder scheme is only rejected by App Store Connect after the
# whole upload (90158); a missing one ships a build whose OAuth redirect cannot
# come back. Both the local release script and the workflow run this between
# the build and the upload.
set -euo pipefail

IPA="${1:?usage: check-ipa-url-schemes.sh <path.ipa> [<scheme>]}"
WANT="${2:-}"

# Only the app's own Info.plist, not the frameworks' underneath it.
PLIST=$(unzip -Z1 "$IPA" | grep -E '^Payload/[^/]+\.app/Info\.plist$' | head -1)
if [[ -z $PLIST ]]; then
  echo "error: no Payload/*.app/Info.plist inside $IPA" >&2
  exit 1
fi

# Space-separated schemes. Only a well-formed plist *without* the key counts as
# "none"; a plist that cannot be read or parsed fails here rather than passing
# as an app that registers nothing.
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
unzip -p "$IPA" "$PLIST" > "$TMP"
plutil -lint -s "$TMP"
if plutil -type CFBundleURLTypes "$TMP" >/dev/null 2>&1; then
  GOT=$(plutil -extract CFBundleURLTypes json -o - "$TMP" \
    | jq -r '[.[].CFBundleURLSchemes[]] | join(" ")')
else
  GOT=""
fi

if [[ $GOT != "$WANT" ]]; then
  echo "error: the IPA registers URL schemes [$GOT], expected [$WANT]." >&2
  echo "       The deep-link build script did not rewrite Info.plist; see" >&2
  echo "       docs/releasing-ios.md, troubleshooting 90158." >&2
  exit 1
fi

echo "check-ipa-url-schemes: IPA registers [${GOT:-none}] as intended"
