import { describe, it, expect, beforeEach } from 'vitest'
import { hydrateSettings, makeStore, updateSettings, useStore } from '@/store'
import { DEFAULT_SETTINGS } from '@/store/settingsSlice'
import i18n from '@/i18n'
import { calls, clearCalls, mockCommand } from './ipc'

// The store's half of the settings contract. What a patch does to the file is
// Rust's business (`src-tauri/src/settings.rs`); what it does here is land
// immediately, then be replaced by whatever came back.

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  makeStore()
})

describe('settings slice', () => {
  it('starts on the same defaults Rust does', () => {
    expect(useStore.getState().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('takes the boot probe wholesale', () => {
    hydrateSettings({ ...DEFAULT_SETTINGS, theme: 'dark', listSort: 'alpha' })

    expect(useStore.getState().settings.listSort).toBe('alpha')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies a patch before the write and sends only what changed', async () => {
    updateSettings({ autolockSecs: 900 })

    expect(useStore.getState().settings.autolockSecs).toBe(900)
    expect(calls('set_settings')).toContainEqual({ patch: { autolockSecs: 900 } })

    await settled()
    // The merged answer is authoritative, and carries the untouched keys back.
    expect(useStore.getState().settings.clipboardTimeoutMs).toBe(
      DEFAULT_SETTINGS.clipboardTimeoutMs
    )
  })

  it('replaces the optimistic value with what Rust merged', async () => {
    mockCommand('set_settings', () => ({ ...DEFAULT_SETTINGS, autolockSecs: 3600 }))
    updateSettings({ autolockSecs: 900 })
    await settled()

    expect(useStore.getState().settings.autolockSecs).toBe(3600)
  })

  // The preference still applies for this session; it just won't survive a
  // restart, which is better than snapping the control back under the user.
  it('keeps the optimistic value when the write fails', async () => {
    mockCommand('set_settings', () => Promise.reject({ kind: 'io', message: 'read-only' }))
    updateSettings({ breachCheck: true })
    await settled()

    expect(useStore.getState().settings.breachCheck).toBe(true)
  })

  // The boot init already ran in setup.ts and fired `languageChanged`; had it
  // been persisted, the fresh install would be pinned to en-US instead of
  // following the OS.
  it('persists a language change, but not the one init fires', async () => {
    expect(useStore.getState().settings.locale).toBeNull()
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
