// Fails when a deep-link scheme in the iOS config is not a legal URL scheme.
// The Tauri CLI ships these verbatim as CFBundleURLTypes, and App Store Connect
// rejects the upload over a malformed one — error 90158, "URL schemes need to
// begin with an alphabetic character, and be comprised of alphanumeric
// characters, the period, the hyphen or the plus sign only" (RFC 1738). That
// rejection arrives at the end of a full build *and* a full upload, on both the
// local script and the release workflow, so both run this first.
//
// The scheme that matters here is Google's reversed iOS client id (README,
// "Drive sync on iOS"). Its committed placeholder contains an underscore, which
// is exactly the illegal case.
//
// Usage: bun scripts/check-ios-url-schemes.mjs

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// RFC 1738 as Apple enforces it: leading letter, then letters, digits, '.', '+', '-'.
const LEGAL = /^[A-Za-z][A-Za-z0-9.+-]*$/

// plugins > deep-link > mobile is a list of entries, each with a `scheme` list.
// Absent is fine: an iOS build with no deep link registers no URL types.
const entries = config.plugins?.['deep-link']?.mobile ?? []
const schemes = entries.flatMap((entry) => entry.scheme ?? [])

const bad = schemes.filter((s) => !LEGAL.test(s))
if (bad.length > 0) {
  console.error('check-ios-url-schemes: illegal URL scheme in src-tauri/tauri.ios.conf.json:')
  for (const s of bad) console.error(`  ${s}`)
  console.error(
    '\nApp Store Connect rejects the upload with error 90158. A scheme must start\n' +
      'with a letter and hold only letters, digits, ".", "+" or "-".\n' +
      'Put the reversed iOS OAuth client id in (README, "Drive sync on iOS"), or\n' +
      'delete the "deep-link" block to ship without Drive sign-in on iOS.',
  )
  process.exit(1)
}

console.log(
  schemes.length === 0
    ? 'check-ios-url-schemes: no deep-link schemes configured'
    : `check-ios-url-schemes: ${schemes.length} scheme(s) OK`,
)
