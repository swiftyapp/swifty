#!/usr/bin/env node
// Cross-implementation round-trip: Rust encrypts -> Node decrypts, and vice
// versa. Random salt/IV means fixed output vectors are impossible, so we prove
// equivalence by having each side read what the other produced.
//
// Run: node scripts/crypto-crosscheck.mjs   (builds the Rust example first)

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { Cryptor, hashSecret } from './crypto-ref.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = path.join(root, 'src-tauri/target/debug/examples/crypto_cli')

console.log('building rust example...')
execFileSync('cargo', ['build', '--example', 'crypto_cli'], {
  cwd: path.join(root, 'src-tauri'),
  stdio: 'inherit'
})

const rust = (...args) => execFileSync(bin, args, { encoding: 'utf8' })

const password = 'a shared master password ✨'
const secret = hashSecret(password)
const node = new Cryptor(secret)

const values = ['', 'plain value', 'unicode 密码 пароль 🔑', 'y'.repeat(8000)]
const objects = [
  { entries: [] },
  { entries: [{ id: '1', title: 'x' }], meta: { n: 7, s: 'два', b: true } }
]

let checks = 0
const ok = (label, cond) => {
  assert.ok(cond, `FAILED: ${label}`)
  checks++
}
const eq = (label, a, b) => {
  // Structural equality: JSON key order is not part of the format.
  assert.deepStrictEqual(a, b, `FAILED: ${label}`)
  checks++
}

// hash_secret parity
ok('hash_secret parity', rust('hash-secret', password) === secret)

for (const v of values) {
  // Rust encrypts -> Node decrypts
  ok(`rust->node field (${v.length})`, node.decrypt(rust('encrypt', secret, v)) === v)
  // Node encrypts -> Rust decrypts
  ok(`node->rust field (${v.length})`, rust('decrypt', secret, node.encrypt(v)) === v)
}

for (const obj of objects) {
  const j = JSON.stringify(obj)
  // Rust encrypts blob -> Node decrypts
  eq('rust->node data', node.decryptData(rust('encrypt-data', secret, j)), obj)
  // Node encrypts blob -> Rust decrypts
  eq('node->rust data', JSON.parse(rust('decrypt-data', secret, node.encryptData(obj))), obj)
}

console.log(`cross-impl round-trips passed (${checks} checks)`)
