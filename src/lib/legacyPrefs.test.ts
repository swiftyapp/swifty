import { describe, it, expect, beforeEach } from 'vitest'
import { adoptLegacyPrefs, clearLegacyPrefs, legacyPatch } from './legacyPrefs'
import { DEFAULT_SETTINGS } from '@/store/settingsSlice'
import { calls, mockCommand } from '@/test/ipc'

beforeEach(() => localStorage.clear())

describe('legacyPatch', () => {
  it('is null on a clean install', () => {
    expect(legacyPatch(DEFAULT_SETTINGS)).toBeNull()
  })

  it('reads every old key, validated the way its getter was', () => {
    localStorage.setItem('rowel:autolockSecs', '900')
    localStorage.setItem('rowel:clipboardTimeout', '0')
    localStorage.setItem('rowel:dateFormat', 'DD.MM.YYYY')
    localStorage.setItem('rowel:listSort', 'alpha')
    localStorage.setItem('rowel:breachCheck', 'true')
    localStorage.setItem('rowel:generatorDefaults', '{"length":32,"symbols":false}')
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('locale', 'de-DE')

    expect(legacyPatch(DEFAULT_SETTINGS)).toEqual({
      autolockSecs: 900,
      clipboardTimeoutMs: 0,
      dateFormat: 'DD.MM.YYYY',
      listSort: 'alpha',
      breachCheck: true,
      theme: 'dark',
      locale: 'de-DE',
      // Laid over the current group, since Rust replaces it whole.
      generator: { ...DEFAULT_SETTINGS.generator, length: 32, symbols: false }
    })
  })

  it('skips junk rather than writing it into the file', () => {
    localStorage.setItem('rowel:autolockSecs', '-5')
    localStorage.setItem('rowel:dateFormat', 'YYYY/MM/DD')
    localStorage.setItem('rowel:listSort', 'newest')
    localStorage.setItem('rowel:breachCheck', 'yes')
    localStorage.setItem('rowel:generatorDefaults', '{not json')
    localStorage.setItem('theme', 'purple')
    localStorage.setItem('locale', 'xx-XX')

    expect(legacyPatch(DEFAULT_SETTINGS)).toBeNull()
  })

  it('prefers the post-rebrand key over the pre-rebrand one', () => {
    localStorage.setItem('swifty:autolockSecs', '300')
    localStorage.setItem('rowel:autolockSecs', '900')
    localStorage.setItem('swifty:listSort', 'alpha')

    expect(legacyPatch(DEFAULT_SETTINGS)).toEqual({ autolockSecs: 900, listSort: 'alpha' })
  })
})

describe('adoptLegacyPrefs', () => {
  it('writes the patch once and removes the keys', async () => {
    localStorage.setItem('swifty:breachCheck', 'true')
    localStorage.setItem('theme', 'system')

    const settings = await adoptLegacyPrefs(DEFAULT_SETTINGS)

    expect(calls('set_settings')).toEqual([{ patch: { breachCheck: true, theme: 'system' } }])
    expect(settings.breachCheck).toBe(true)
    expect(settings.theme).toBe('system')
    expect(localStorage.getItem('swifty:breachCheck')).toBeNull()
    expect(localStorage.getItem('theme')).toBeNull()
    // Nothing left to import: the next boot is a no-op.
    expect(legacyPatch(DEFAULT_SETTINGS)).toBeNull()
  })

  it('keeps the keys for the next boot when the write fails', async () => {
    localStorage.setItem('rowel:listSort', 'alpha')
    mockCommand('set_settings', () => Promise.reject({ kind: 'io', message: 'read-only' }))

    const settings = await adoptLegacyPrefs(DEFAULT_SETTINGS)

    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(localStorage.getItem('rowel:listSort')).toBe('alpha')
  })

  it('does not call the backend when there is nothing to import', async () => {
    await adoptLegacyPrefs(DEFAULT_SETTINGS)
    expect(calls('set_settings')).toEqual([])
  })
})

describe('clearLegacyPrefs', () => {
  it('removes both prefixes and the bare keys', () => {
    localStorage.setItem('rowel:autolockSecs', '900')
    localStorage.setItem('swifty:generatorDefaults', '{}')
    localStorage.setItem('locale', 'fr-FR')
    localStorage.setItem('unrelated', 'kept')

    clearLegacyPrefs()

    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('unrelated')).toBe('kept')
  })
})
