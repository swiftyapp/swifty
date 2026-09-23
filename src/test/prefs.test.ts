import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import type { Settings } from '@/api/app'
import {
  DEFAULT_PREFS,
  hydrateFromProbe,
  hydratePrefs,
  prefsMark,
  setPref,
  toggleTheme,
  usePrefs
} from '@/store/prefs'
import { appStatusDefault, calls, clearCalls, mockCommand, mockCommandOnce } from './ipc'
import { deferred } from './utils'

// The store's half of the preferences contract. What a patch does to the file
// is Rust's business (`src-tauri/src/settings.rs`); what it does here is land
// immediately, then be replaced by whatever came back.

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('prefs', () => {
  it('starts on the same defaults Rust does', () => {
    expect(usePrefs.getState()).toEqual(DEFAULT_PREFS)
  })

  // The fake backend cannot import the store (its mock is what the store's own
  // IPC seam loads), so a fresh install is spelled out in both places. This is
  // what keeps the two copies the same one: they had already drifted by a
  // generator flag, which is a preference the app would have read as unset.
  it('is the same fresh install the fake backend hands back', () => {
    expect(appStatusDefault().settings).toEqual(DEFAULT_PREFS)
  })

  it('takes the boot probe wholesale', () => {
    hydratePrefs({ ...DEFAULT_PREFS, theme: 'dark', sort: 'alpha' })

    expect(usePrefs.getState().sort).toBe('alpha')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  // A backend from before the preference existed merges the patch into a struct
  // with no field for it and answers without the key. The choice has to stand
  // for the session anyway, or every click snaps straight back to the default.
  it('keeps a choice an older backend does not echo back', async () => {
    const older: Partial<Settings> = { ...DEFAULT_PREFS }
    delete older.accent
    mockCommand('set_settings', () => older)

    setPref('accent', 'ruby')
    await settled()

    expect(usePrefs.getState().accent).toBe('ruby')
    expect(document.documentElement.getAttribute('data-accent')).toBe('ruby')
  })

  // Two keys written back to back, the second answered first with the file as
  // it stood before the first was merged: the first key's choice must survive
  // that answer, and the first answer arriving late must not undo the second.
  it('keeps an unanswered write over another key’s answer', async () => {
    const accentWrite = deferred<Settings>()
    const themeWrite = deferred<Settings>()
    mockCommandOnce('set_settings', () => accentWrite.promise)
    mockCommandOnce('set_settings', () => themeWrite.promise)

    setPref('accent', 'ruby')
    setPref('theme', 'dark')

    // The theme's answer lands first, and the backend merged it before the
    // accent's patch reached it.
    themeWrite.resolve({ ...DEFAULT_PREFS, theme: 'dark' })
    await settled()
    expect(usePrefs.getState().accent).toBe('ruby')
    expect(usePrefs.getState().theme).toBe('dark')

    // The accent's answer, older, arrives with the file as it was after its
    // own merge — before the theme's. It is not allowed to put light back.
    accentWrite.resolve({ ...DEFAULT_PREFS, accent: 'ruby' })
    await settled()
    expect(usePrefs.getState().accent).toBe('ruby')
    expect(usePrefs.getState().theme).toBe('dark')

    // Nothing is pending any more, so the next probe is trusted.
    hydrateFromProbe({ ...DEFAULT_PREFS, accent: 'moss', theme: 'dark' }, prefsMark())
    expect(usePrefs.getState().accent).toBe('moss')
  })

  // A probe (`app_status`) carries the settings too, and one that raced a write
  // — read the file before the write, landed after it — must not put the old
  // value back. The mark taken when the probe went out is what tells.
  describe('a probe that carries settings', () => {
    it('is taken when nothing was written meanwhile', () => {
      hydrateFromProbe({ ...DEFAULT_PREFS, accent: 'moss' }, prefsMark())
      expect(usePrefs.getState().accent).toBe('moss')
    })

    it('is ignored when a write overtook it', async () => {
      const mark = prefsMark()
      setPref('accent', 'ruby')
      await settled()

      hydrateFromProbe({ ...DEFAULT_PREFS }, mark)
      expect(usePrefs.getState().accent).toBe('ruby')
    })

    it('is ignored while a write is still unanswered, whose answer then lands', async () => {
      const write = deferred<Settings>()
      mockCommandOnce('set_settings', () => write.promise)
      setPref('accent', 'ruby')

      // Went out after the write, so the mark is current — but the write's
      // answer is still the newer fact, and a probe served before the merge
      // would carry the old value.
      hydrateFromProbe({ ...DEFAULT_PREFS }, prefsMark())
      expect(usePrefs.getState().accent).toBe('ruby')

      write.resolve({ ...DEFAULT_PREFS, accent: 'ruby' })
      await settled()
      expect(usePrefs.getState().accent).toBe('ruby')

      // Settled: the next probe is trusted again.
      hydrateFromProbe({ ...DEFAULT_PREFS, accent: 'moss' }, prefsMark())
      expect(usePrefs.getState().accent).toBe('moss')
    })
  })

  // The accent rides on the root the way the theme does, so theme.css can key
  // its tokens off both.
  it('paints the root with the stored accent', () => {
    hydratePrefs({ ...DEFAULT_PREFS, accent: 'copper' })
    expect(document.documentElement.getAttribute('data-accent')).toBe('copper')

    setPref('accent', 'ink')
    expect(document.documentElement.getAttribute('data-accent')).toBe('ink')
  })

  // The file is user-writable, so what comes off it is checked field by field.
  it('puts a junk value back to its default on the way in', () => {
    hydratePrefs({
      ...DEFAULT_PREFS,
      theme: 'purple' as never,
      accent: 'neon' as never,
      autolockSecs: -5,
      dateFormat: 'YYYY/MM/DD' as never,
      generator: { ...DEFAULT_PREFS.generator, length: 'nope' as never }
    })

    const state = usePrefs.getState()
    expect(state.theme).toBe('light')
    expect(state.accent).toBe('ink')
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
