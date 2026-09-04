import { describe, it, expect } from 'vitest'
import { KINDS, kindOf } from '.'
import type { EntryDraft } from '@/defaults/entries'
import type { Passkey } from '@/lib/commands'

// What each kind will let through to `saveEntry` — the only thing standing
// between a typed draft and the vault.

const login = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'login',
  title: 'Acme',
  username: 'octocat',
  password: 'hunter2',
  ...overrides
})

const card = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'card',
  title: 'Visa',
  number: '4111111111111111',
  cvc: '123',
  month: '04',
  year: '29',
  ...overrides
})

const note = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'note',
  title: 'Wifi',
  note: 'the code is on the router',
  ...overrides
})

// Everything a passport requires, which is the type a new identity starts as.
const identity = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'identity',
  title: 'UK Passport',
  doc_type: 'passport',
  name: 'ADA LOVELACE',
  number: 'X1234567',
  country: 'GBR',
  expiry_date: '2035-06-01',
  ...overrides
})

const ssh = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'ssh',
  title: 'Deploy key',
  privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nc2VjcmV0\n-----END OPENSSH PRIVATE KEY-----\n',
  publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI alice@laptop',
  fingerprint: 'SHA256:0123456789abcdef',
  ...overrides
})

// The registry is the whole contract: a kind that is not in `KINDS` reaches no
// picker, chip or palette command.
describe('KINDS', () => {
  it('registers every entry type exactly once, in display order', () => {
    expect(KINDS.map(kind => kind.type)).toEqual([
      'login',
      'card',
      'note',
      'identity',
      'ssh'
    ])
    for (const kind of KINDS) expect(kindOf(kind.type)).toBe(kind)
  })
})

describe('isValid', () => {
  it('accepts a complete draft of every kind', () => {
    expect(kindOf('login').isValid(login())).toBe(true)
    expect(kindOf('card').isValid(card())).toBe(true)
    expect(kindOf('note').isValid(note())).toBe(true)
    expect(kindOf('identity').isValid(identity())).toBe(true)
    expect(kindOf('ssh').isValid(ssh())).toBe(true)
  })

  // Everything but the private key is optional: a pasted key routinely has no
  // fingerprint (nothing derives one) and no passphrase.
  it('holds an SSH key to its title and its private half', () => {
    expect(kindOf('ssh').isValid(ssh({ privateKey: '' }))).toBe(false)
    expect(kindOf('ssh').isValid(ssh({ title: '' }))).toBe(false)
    expect(kindOf('ssh').isValid(ssh({ publicKey: '', fingerprint: '' }))).toBe(true)
  })

  // Which fields an identity must have is the document's business, not the
  // kind's: a licence is void without an expiry date, an ID card is not.
  it('holds an identity to its own document type’s required fields', () => {
    expect(kindOf('identity').isValid(identity({ number: '' }))).toBe(false)
    expect(kindOf('identity').isValid(identity({ country: '' }))).toBe(false)
    expect(kindOf('identity').isValid(identity({ expiry_date: '' }))).toBe(false)

    // An ID card asks for no expiry date, so the same draft passes.
    expect(
      kindOf('identity').isValid(identity({ doc_type: 'id_card', expiry_date: '' }))
    ).toBe(true)
    // A licence asks for one again.
    expect(
      kindOf('identity').isValid(identity({ doc_type: 'driver_license', expiry_date: '' }))
    ).toBe(false)
    // "Other" asks only for a name and a number.
    expect(
      kindOf('identity').isValid(
        identity({ doc_type: 'other', country: '', expiry_date: '' })
      )
    ).toBe(true)
  })

  // An unknown type still has to render and save as something, so it reads as
  // the passport a new identity starts from.
  it('falls back to the passport template on an unknown document type', () => {
    expect(kindOf('identity').isValid(identity({ doc_type: 'spaceship' }))).toBe(true)
    expect(
      kindOf('identity').isValid(identity({ doc_type: 'spaceship', expiry_date: '' }))
    ).toBe(false)
  })

  // A field holding only spaces reads as empty and saves as empty, so it is
  // not a value — for any kind, in any required field.
  it('refuses a whitespace-only required field', () => {
    expect(kindOf('login').isValid(login({ title: '   ' }))).toBe(false)
    expect(kindOf('login').isValid(login({ username: ' ' }))).toBe(false)
    expect(kindOf('login').isValid(login({ password: '\t' }))).toBe(false)
    expect(kindOf('card').isValid(card({ number: '  ' }))).toBe(false)
    expect(kindOf('card').isValid(card({ month: ' ' }))).toBe(false)
    expect(kindOf('note').isValid(note({ note: '  \n ' }))).toBe(false)
    expect(kindOf('identity').isValid(identity({ name: ' ' }))).toBe(false)
    expect(kindOf('identity').isValid(identity({ number: '\t' }))).toBe(false)
    expect(kindOf('ssh').isValid(ssh({ privateKey: '  ' }))).toBe(false)
  })

  // Extra fields are free-form, so no kind can require one: a document with a
  // half-filled row still saves, and a filled one buys nothing.
  it('lets extra fields say nothing about validity', () => {
    expect(kindOf('identity').isValid(identity({ extra: [{ label: '', value: '' }] }))).toBe(
      true
    )
    expect(
      kindOf('identity').isValid(identity({ extra: [{ label: 'Categories', value: 'B' }] }))
    ).toBe(true)
    expect(
      kindOf('identity').isValid(
        identity({ number: '', extra: [{ label: 'Categories', value: 'B' }] })
      )
    ).toBe(false)
  })

  it('holds the login to the email complaint the row already shows', () => {
    expect(kindOf('login').isValid(login({ email: 'me@example.com' }))).toBe(true)
    // Optional stays optional.
    expect(kindOf('login').isValid(login({ email: '' }))).toBe(true)
    expect(kindOf('login').isValid(login({ email: 'me@example' }))).toBe(false)
  })

  // A passkey is a credential in its own right — a login that has one needs no
  // password, which is the only shape an imported passkey-only login is in.
  it('takes a passkey in place of a login password', () => {
    const passkey: Passkey = {
      credentialId: 'Y3JlZDE',
      rpId: 'acme.test',
      userHandle: 'dWgx',
      userName: 'alice',
      userDisplayName: 'Alice',
      privateKey: 'cGsx',
      counter: 0
    }

    expect(kindOf('login').isValid(login({ password: '', passkeys: [passkey] }))).toBe(true)
    // Neither credential is still not a login.
    expect(kindOf('login').isValid(login({ password: '' }))).toBe(false)
    expect(kindOf('login').isValid(login({ password: '', passkeys: [] }))).toBe(false)
  })
})
