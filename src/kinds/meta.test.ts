import { describe, it, expect } from 'vitest'
import { kindOf } from '.'
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

describe('isValid', () => {
  it('accepts a complete draft of every kind', () => {
    expect(kindOf('login').isValid(login())).toBe(true)
    expect(kindOf('card').isValid(card())).toBe(true)
    expect(kindOf('note').isValid(note())).toBe(true)
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
