import { describe, it, expect } from 'vitest'
import { kindOf } from '.'
import type { EntryDraft } from '@/defaults/entries'

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
})
