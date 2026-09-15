import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import type { Settings } from '@/api/app'
import { DEFAULT_PREFS, hydratePrefs, setPref, toggleTheme, usePrefs } from '@/store/prefs'
import { calls, clearCalls, mockCommand, mockCommandOnce } from './ipc'
import { deferred } from './utils'

// The store's half of the preferences contract. What a patch does to the file
// is Rust's business (`src-tauri/src/settings.rs`); what it does here is land
// immediately, then be replaced by whatever came back.

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('prefs', () => {
  it('starts on the same defaults Rust does', () => {
    expect(usePrefs.getState()).toEqual(DEFAULT_PREFS)
  })

  it('takes the boot probe wholesale', () => {
    hydratePrefs({ ...DEFAULT_PREFS, theme: 'dark', sort: 'alpha' })

    expect(usePrefs.getState().sort).toBe('alpha')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  // The file is user-writable, so what comes off it is checked field by field.
  it('puts a junk value back to its default on the way in', () => {
    hydratePrefs({
      ...DEFAULT_PREFS,
      theme: 'purple' as never,
      autolockSecs: -5,
      dateFormat: 'YYYY/MM/DD' as never,
      generator: { ...DEFAULT_PREFS.generator, length: 'nope' as never }
    })

    const state = usePrefs.getState()
    expect(state.theme).toBe('light')
    expect(state.autolockSecs).toBe(60)
    expect(state.dateFormat).toBe('MM/DD/YYYY')
    expect(state.generator.length).toBe(20)
  })

  it('applies a patch before the write and sends only what changed', async () => {
    setPref('autolockSecs', 900)

    expect(usePrefs.getState().autolockSecs).toBe(900)
    expect(calls('set_settings')).toContainEqual({ patch: { autolockSecs: 900 } })

    await settled()
    // The merged answer is authoritative, and carries the untouched keys back.
    expect(usePrefs.getState().clipboardTimeoutMs).toBe(DEFAULT_PREFS.clipboardTimeoutMs)
  })

  it('replaces the optimistic value with what Rust merged', async () => {
    mockCommand('set_settings', () => ({ ...DEFAULT_PREFS, autolockSecs: 3600 }))
    setPref('autolockSecs', 900)
    await settled()

    expect(usePrefs.getState().autolockSecs).toBe(3600)
  })

  // The preference still applies for this session; it just won't survive a
  // restart, which is better than snapping the control back under the user.
  it('keeps the optimistic value when the write fails', async () => {
    mockCommand('set_settings', () => Promise.reject({ kind: 'io', message: 'read-only' }))
    setPref('breachCheck', true)
    await settled()

    expect(usePrefs.getState().breachCheck).toBe(true)
  })

  // Answers can land out of order, and each carries the whole file: the answer
  // to an older write must not put back a value the user has moved past.
  it('ignores the answer to a write that is no longer the latest', async () => {
    const first = deferred<Settings>()
    const second = deferred<Settings>()
    mockCommandOnce('set_settings', () => first.promise)
    mockCommandOnce('set_settings', () => second.promise)

    setPref('autolockSecs', 300)
    setPref('autolockSecs', 900)
    expect(usePrefs.getState().autolockSecs).toBe(900)

    second.resolve({ ...DEFAULT_PREFS, autolockSecs: 900 })
    await settled()
    first.resolve({ ...DEFAULT_PREFS, autolockSecs: 300 })
    await settled()

    expect(usePrefs.getState().autolockSecs).toBe(900)
  })

  it('flips the theme both ways', async () => {
    expect(usePrefs.getState().theme).toBe('light')

    toggleTheme()
    expect(usePrefs.getState().theme).toBe('dark')
    await settled()

    toggleTheme()
    expect(usePrefs.getState().theme).toBe('light')
  })

  // The boot init already ran in setup.ts and fired `languageChanged`; had it
  // been persisted, the fresh install would be pinned to en-US instead of
  // following the OS.
  it('persists a language change, but not the one init fires', async () => {
    expect(usePrefs.getState().locale).toBeNull()
    expect(calls('set_settings')).toEqual([])

    await i18n.changeLanguage('de-DE')
    expect(calls('set_settings')).toContainEqual({ patch: { locale: 'de-DE' } })

    // Re-selecting the current language is not a change worth a disk write.
    clearCalls('set_settings')
    await i18n.changeLanguage('de-DE')
    expect(calls('set_settings')).toEqual([])

    await i18n.changeLanguage('en-US')
  })
})
