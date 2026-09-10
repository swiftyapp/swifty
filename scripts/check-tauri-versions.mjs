// Fails when a Tauri npm package and its Rust crate are on different
// major.minor releases — the same check `tauri build` runs before compiling
// ("Found version mismatched Tauri packages"). Dependabot bumps the npm and
// cargo sides in separate PRs, so the two lockfiles drift; this catches it in
// CI instead of in the release build.
//
// Pairs, as the Tauri CLI defines them:
//   @tauri-apps/api       <-> tauri
//   @tauri-apps/plugin-X  <-> tauri-plugin-X
// Only pairs present on both sides are compared (Rust-only plugins are skipped).
//
// Usage: bun scripts/check-tauri-versions.mjs

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bunLock = readFileSync(join(root, 'bun.lock'), 'utf8')
const cargoLock = readFileSync(join(root, 'src-tauri', 'Cargo.lock'), 'utf8')

// bun.lock resolutions look like "@tauri-apps/plugin-updater@2.10.1".
const npm = new Map()
for (const [, name, version] of bunLock.matchAll(
  /"@tauri-apps\/(api|plugin-[a-z-]+)@(\d+\.\d+\.\d+)[^"]*"/g,
)) {
  npm.set(name, version)
}

// Cargo.lock packages are `name = "tauri-plugin-updater"` / `version = "2.11.0"`.
const crates = new Map()
for (const [, name, version] of cargoLock.matchAll(
  /name = "(tauri|tauri-plugin-[a-z-]+)"\nversion = "([^"]+)"/g,
)) {
  if (!crates.has(name)) crates.set(name, [])
  crates.get(name).push(version)
}

// Fail closed: every Tauri app has `@tauri-apps/api` and the `tauri` crate, so
// if either is missing the lockfile format has changed and the regexes above
// no longer see anything. Do not let that pass as "0 packages agree".
const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}
if (!npm.has('api')) fail('check-tauri-versions: no @tauri-apps/api entry found in bun.lock (format changed?)')
if (!crates.has('tauri')) fail('check-tauri-versions: no `tauri` package found in src-tauri/Cargo.lock (format changed?)')

const majorMinor = (v) => v.split('.').slice(0, 2).join('.')

const mismatched = []
let compared = 0
for (const [npmName, npmVersion] of npm) {
  const crateName = npmName === 'api' ? 'tauri' : `tauri-${npmName}`
  const crateVersions = crates.get(crateName)
  // The CLI only compares pairs installed on both sides; an npm plugin with
  // no crate is a project-shape question, not a version mismatch.
  if (!crateVersions) continue
  compared++
  if (!crateVersions.some((v) => majorMinor(v) === majorMinor(npmVersion))) {
    mismatched.push(
      `${crateName} (v${crateVersions.join(', v')}) : @tauri-apps/${npmName} (v${npmVersion})`,
    )
  }
}

if (compared === 0) fail('check-tauri-versions: no npm/crate pairs were compared')

if (mismatched.length > 0) {
  console.error(
    'Found version mismatched Tauri packages. The npm package and Rust crate must be on the same major/minor release:',
  )
  for (const line of mismatched) console.error(`  ${line}`)
  console.error(
    '\nBump the lagging side (package.json + `bun install`, or src-tauri/Cargo.toml + `cargo update -p <crate>`) so both agree.',
  )
  process.exit(1)
}

console.log(`Tauri npm/crate versions agree (${compared} npm/crate pairs checked).`)
