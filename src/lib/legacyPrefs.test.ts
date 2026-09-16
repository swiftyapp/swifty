import { describe, it, expect, beforeEach } from 'vitest'
import { adoptLegacyPrefs, clearLegacyPrefs, legacyPatch } from './legacyPrefs'
import { DEFAULT_PREFS } from '@/store/prefs'
import { appStatusDefault, calls, mockCommand } from '@/test/ipc'

beforeEach(() => localStorage.clear())

// What the boot probe answered before anything was imported.
const booted = () => appStatusDefault()

// The same probe, with the locale Rust resolved the current settings to.
const probe = (locale = booted().locale) => ({ ...booted(), locale, settings: DEFAULT_PREFS })

describe('legacyPatch', () => {
  it('is null on a clean install', () => {
    expect(legacyPatch(probe())).toBeNull()
  })

  it('reads every per-key value, validated the way its getter was', () => {
    localStorage.setItem('rowel:autolockSecs', '900')
    localStorage.setItem('rowel:clipboardTimeout', '0')
    localStorage.setItem('rowel:dateFormat', 'DD.MM.YYYY')
    localStorage.setItem('rowel:listSort', 'alpha')
    localStorage.setItem('rowel:breachCheck', 'true')
    localStorage.setItem('rowel:generatorDefaults', '{"length":32,"symbols":false}')
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('locale', 'de-DE')

    expect(legacyPatch(probe())).toEqual({
      autolockSecs: 900,
      clipboardTimeoutMs: 0,
      dateFormat: 'DD.MM.YYYY',
      sort: 'alpha',
      breachCheck: true,
      theme: 'dark',
      locale: 'de-DE',
      // Laid over the current group, since Rust replaces it whole.
      generator: { ...DEFAULT_PREFS.generator, length: 32, symbols: false }
    })
  })

  it('reads the persisted prefs blob, which wins over the per-key values', () => {
    localStorage.setItem('rowel:listSort', 'recent')
    localStorage.setItem('rowel:autolockSecs', '300')
    localStorage.setItem(
      'rowel:prefs',
      JSON.stringify({
        state: { sort: 'alpha', theme: 'system', clipboardTimeoutMs: 15000, generator: { length: 24 } },
        version: 0
      })
    )

    expect(legacyPatch(probe())).toEqual({
      autolockSecs: 300,
      clipboardTimeoutMs: 15000,
      sort: 'alpha',
      theme: 'system',
      generator: { ...DEFAULT_PREFS.generator, length: 24 }
    })
  })

  it('skips junk rather than writing it into the file', () => {
    localStorage.setItem('rowel:autolockSecs', '-5')
    localStorage.setItem('rowel:dateFormat', 'YYYY/MM/DD')
    localStorage.setItem('rowel:listSort', 'newest')
    localStorage.setItem('rowel:breachCheck', 'yes')
    localStorage.setItem('rowel:generatorDefaults', '{not json')
    localStorage.setItem('rowel:prefs', '{"state":{"generator":{"length":"nope"}}}')
    localStorage.setItem('theme', 'purple')
    localStorage.setItem('locale', 'xx-XX')

    expect(legacyPatch(probe())).toBeNull()
  })

  // The old storage never checked types. One wrong-typed knob must not fail
  // Rust's typed decode and take every other preference down with it.
  it('drops a wrong-typed generator knob and keeps the rest of the patch', () => {
    localStorage.setItem('rowel:generatorDefaults', '{"length":32,"numbers":"yes","exclude":7}')
    localStorage.setItem('theme', 'dark')

    expect(legacyPatch(probe())).toEqual({
      theme: 'dark',
      generator: { ...DEFAULT_PREFS.generator, length: 32 }
    })
  })

  // The old i18n module persisted `locale` on every `languageChanged`, which
  // i18next emits during `init` — so a value matching what Rust resolves to
  // today says nothing, and importing it would pin the user to a stale OS
  // language instead of following the one they are on.
  it('skips a bare locale that matches the resolved one', () => {
    localStorage.setItem('locale', 'de-DE')

    expect(legacyPatch(probe('de-DE'))).toBeNull()

    // Skipped is not forgotten: whenever an import does run, the sweep still
    // removes the key along with the rest.
    clearLegacyPrefs()
    expect(localStorage.getItem('locale')).toBeNull()
  })

  it('imports a bare locale that differs from the resolved one', () => {
    localStorage.setItem('locale', 'fr-FR')

    expect(legacyPatch(probe('de-DE'))).toEqual({ locale: 'fr-FR' })
  })

  it('prefers the post-rebrand key over the pre-rebrand one', () => {
    localStorage.setItem('swifty:autolockSecs', '300')
    localStorage.setItem('rowel:autolockSecs', '900')
    localStorage.setItem('swifty:listSort', 'alpha')

    expect(legacyPatch(probe())).toEqual({ autolockSecs: 900, sort: 'alpha' })
  })
})

describe('adoptLegacyPrefs', () => {
  it('writes the patch once, removes the keys and re-reads the probe', async () => {
    localStorage.setItem('swifty:breachCheck', 'true')
    localStorage.setItem('locale', 'de-DE')
    // Rust resolves the stored choice; the frontend takes its word for it.
    mockCommand('app_status', () => ({
      ...appStatusDefault(),
      locale: 'de-DE',
      settings: { ...DEFAULT_PREFS, breachCheck: true, locale: 'de-DE' }
    }))

    const status = await adoptLegacyPrefs(booted())

    expect(calls('set_settings')).toEqual([{ patch: { breachCheck: true, locale: 'de-DE' } }])
    expect(calls('app_status')).toHaveLength(1)
    expect(status.locale).toBe('de-DE')
    expect(status.settings.breachCheck).toBe(true)
    expect(localStorage.getItem('swifty:breachCheck')).toBeNull()
    expect(localStorage.getItem('locale')).toBeNull()
    // Nothing left to import: the next boot is a no-op.
    expect(legacyPatch(probe())).toBeNull()
  })

  it('keeps the keys for the next boot when the write fails', async () => {
    localStorage.setItem('rowel:listSort', 'alpha')
    mockCommand('set_settings', () => Promise.reject({ kind: 'io', message: 'read-only' }))

    const before = booted()
    const status = await adoptLegacyPrefs(before)

    expect(status).toBe(before)
    expect(calls('app_status')).toEqual([])
    expect(localStorage.getItem('rowel:listSort')).toBe('alpha')
  })

  it('does not call the backend when there is nothing to import', async () => {
    const before = booted()
    expect(await adoptLegacyPrefs(before)).toBe(before)
    expect(calls('set_settings')).toEqual([])
    expect(calls('app_status')).toEqual([])
  })
})

describe('clearLegacyPrefs', () => {
  it('removes the blob, both prefixes and the bare keys', () => {
    localStorage.setItem('rowel:prefs', '{}')
    localStorage.setItem('rowel:autolockSecs', '900')
    localStorage.setItem('swifty:generatorDefaults', '{}')
    localStorage.setItem('locale', 'fr-FR')
    localStorage.setItem('unrelated', 'kept')

    clearLegacyPrefs()

    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('unrelated')).toBe('kept')
  })
})
