import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveInitial, DEFAULT_LOCALE } from '@/i18n'

/**
 * Which locale the app starts in. An explicit choice outranks the OS locale
 * Rust injects into the page, and anything the app has no catalogue for is
 * ignored rather than half-applied.
 */

const KEY = 'rowel:locale'
const LEGACY_KEY = 'locale'

beforeEach(() => {
  localStorage.removeItem(KEY)
  localStorage.removeItem(LEGACY_KEY)
  delete window.__ROWEL_LOCALE__
})

afterEach(() => {
  localStorage.removeItem(KEY)
  localStorage.removeItem(LEGACY_KEY)
  delete window.__ROWEL_LOCALE__
})

describe('resolveInitial', () => {
  it('prefers the stored choice over the injected OS locale', () => {
    localStorage.setItem(KEY, 'fr-FR')
    window.__ROWEL_LOCALE__ = 'de-DE'
    expect(resolveInitial()).toBe('fr-FR')
  })

  it('uses the injected OS locale when nothing is stored', () => {
    window.__ROWEL_LOCALE__ = 'de-DE'
    expect(resolveInitial()).toBe('de-DE')
  })

  it('falls back to the default with neither', () => {
    expect(resolveInitial()).toBe(DEFAULT_LOCALE)
  })

  it('ignores a stored locale the app ships no catalogue for', () => {
    localStorage.setItem(KEY, 'ja-JP')
    window.__ROWEL_LOCALE__ = 'de-DE'
    expect(resolveInitial()).toBe('de-DE')
  })

  it('ignores an injected locale the app ships no catalogue for', () => {
    window.__ROWEL_LOCALE__ = 'ja-JP'
    expect(resolveInitial()).toBe(DEFAULT_LOCALE)
  })

  it('migrates a choice stored under the old unprefixed key', () => {
    localStorage.setItem(LEGACY_KEY, 'pl-PL')
    expect(resolveInitial()).toBe('pl-PL')
    expect(localStorage.getItem(KEY)).toBe('pl-PL')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('does not migrate an unsupported legacy value', () => {
    localStorage.setItem(LEGACY_KEY, 'ja-JP')
    window.__ROWEL_LOCALE__ = 'sv-SE'
    expect(resolveInitial()).toBe('sv-SE')
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
