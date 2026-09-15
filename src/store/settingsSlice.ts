import type { StateCreator } from 'zustand'
import { setSettings, type Settings } from '@/api/app'
import i18n from '@/i18n'
import { applyTheme, watchSystemTheme } from '@/theme/apply'
import type { StoreState } from './index'

/**
 * Every preference, in one place, read from the store rather than from disk at
 * each call site. Rust owns the file (`src-tauri/src/settings.rs`); this is the
 * webview's copy of it, hydrated once at boot from `app_status`.
 *
 * The same defaults as Rust, so a test store — and the split second before
 * hydration lands — reads like a fresh install rather than like `undefined`.
 */
export const DEFAULT_SETTINGS: Settings = {
  autolockSecs: 60,
  clipboardTimeoutMs: 30000,
  dateFormat: 'MM/DD/YYYY',
  listSort: 'recent',
  theme: 'light',
  locale: null,
  breachCheck: false,
  generator: {
    length: 20,
    numbers: true,
    symbols: true,
    uppercase: true,
    exclude: '',
    excludeSimilarCharacters: false
  }
}

export interface SettingsSlice {
  settings: Settings
  /** Take the boot probe's answer wholesale (see `main.tsx`). */
  hydrateSettings: (settings: Settings) => void
  /**
   * Patch one or more preferences. The new value lands immediately — a toggle
   * must not wait on a file write to look pressed — and is then replaced by
   * what Rust merged, which is authoritative. A failed write leaves the
   * optimistic value in place: the preference still applies for this session,
   * it just won't survive a restart.
   */
  updateSettings: (patch: Partial<Settings>) => void
}

export const createSettingsSlice: StateCreator<StoreState, [], [], SettingsSlice> = (
  set,
  get
) => {
  // The document is the theme's other home, so every write goes through here.
  const commit = (settings: Settings) => {
    applyTheme(settings.theme)
    set({ settings })
  }

  const updateSettings = (patch: Partial<Settings>) => {
    commit({ ...get().settings, ...patch })
    setSettings(patch).then(commit).catch(() => {})
  }

  watchSystemTheme(() => {
    if (get().settings.theme === 'system') applyTheme('system')
  })

  // The language is changed through i18next rather than through a row, so this
  // is where that choice becomes a stored preference — one listener, so a
  // change from anywhere is persisted the same way. The document's own `lang`
  // is i18n's half of the same event.
  i18n.on('languageChanged', locale => updateSettings({ locale }))

  return {
    settings: DEFAULT_SETTINGS,
    hydrateSettings: commit,
    updateSettings
  }
}
