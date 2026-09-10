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

const majorMinor = (v) => v.split('.').slice(0, 2).join('.')

const mismatched = []
for (const [npmName, npmVersion] of npm) {
  const crateName = npmName === 'api' ? 'tauri' : `tauri-${npmName}`
  const crateVersions = crates.get(crateName)
  if (!crateVersions) continue
  if (!crateVersions.some((v) => majorMinor(v) === majorMinor(npmVersion))) {
    mismatched.push(
      `${crateName} (v${crateVersions.join(', v')}) : @tauri-apps/${npmName} (v${npmVersion})`,
    )
  }
}

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

console.log(`Tauri npm/crate versions agree (${npm.size} packages checked).`)
