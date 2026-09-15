// Fails when a deep-link scheme the iOS build would register is not a legal
// URL scheme. The Tauri CLI ships these verbatim as CFBundleURLTypes, and App
// Store Connect rejects the upload over a malformed one — error 90158, "URL
// schemes need to begin with an alphabetic character, and be comprised of
// alphanumeric characters, the period, the hyphen or the plus sign only" (RFC
// 1738). That rejection arrives at the end of a full build *and* a full upload,
// on both the local script and the release workflow, so both run this first.
//
// The scheme that matters here is Google's reversed iOS client id (README,
// "Drive sync on iOS"). It comes from one of two places, and both are checked:
// a `deep-link` block committed in src-tauri/tauri.ios.conf.json, or the one
// scripts/ios-build-config.mjs derives from GOOGLE_OAUTH_IOS_CLIENT_ID in the
// environment for the `--config` patch (which replaces the committed list).
//
// Usage: bun scripts/check-ios-url-schemes.mjs

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEGAL_SCHEME, schemeFromClientId } from './ios-build-config.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = join(root, 'src-tauri', 'tauri.ios.conf.json')

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

let config
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'))
} catch (e) {
  fail(`check-ios-url-schemes: cannot read src-tauri/tauri.ios.conf.json: ${e.message}`)
}

// plugins > deep-link > mobile is a list of entries, each with a `scheme` list.
// Absent is fine: an iOS build with no deep link registers no URL types.
const entries = config.plugins?.['deep-link']?.mobile ?? []
const committed = entries.flatMap((entry) => entry.scheme ?? [])

const clientId = process.env.GOOGLE_OAUTH_IOS_CLIENT_ID ?? ''
// A value that is not an iOS client id at all is ios-build-config's error to
// report, with a better message; here it simply contributes no scheme.
const derived = clientId === '' ? [] : [schemeFromClientId(clientId) ?? clientId]

const bad = [...committed, ...derived].filter((s) => !LEGAL_SCHEME.test(s))
if (bad.length > 0) {
  console.error('check-ios-url-schemes: illegal URL scheme for the iOS build:')
  for (const s of bad) console.error(`  ${s}`)
  console.error(
    '\nApp Store Connect rejects the upload with error 90158. A scheme must start\n' +
      'with a letter and hold only letters, digits, ".", "+" or "-".\n' +
      'The scheme is the reversed iOS OAuth client id (README, "Drive sync on\n' +
      'iOS"): fix it in src-tauri/tauri.ios.conf.json or in GOOGLE_OAUTH_IOS_CLIENT_ID,\n' +
      'or drop both to ship without Drive sign-in on iOS.',
  )
  process.exit(1)
}

const total = committed.length + derived.length
console.log(
  total === 0
    ? 'check-ios-url-schemes: no deep-link schemes configured'
    : `check-ios-url-schemes: ${total} scheme(s) OK` +
        (derived.length > 0 ? ' (from GOOGLE_OAUTH_IOS_CLIENT_ID)' : ''),
)
