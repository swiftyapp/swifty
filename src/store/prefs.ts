import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GeneratorOptions } from '@/lib/commands'
import { applyTheme, resolveTheme, type Theme, type ThemePreference } from '@/theme'

/**
 * User preferences: everything that outlives a session and a lock. One store,
 * one localStorage key, persisted by zustand's middleware — so a preference is
 * read like any other state (`usePrefs(s => s.sort)`) and a change re-renders
 * whoever shows it, instead of each preference having its own storage module
 * that components copy into local state.
 */

export type SortMode = 'recent' | 'alpha'

export type DateFormat = 'MM/DD/YYYY' | 'DD.MM.YYYY' | 'YYYY-MM-DD'
export const DATE_FORMATS: DateFormat[] = ['MM/DD/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD']

export interface Prefs {
  /** Light by default, dark opt-in, or follow the OS. */
  theme: ThemePreference
  /** The entry list's order. Recency first: the list is a working surface. */
  sort: SortMode
  /** Off by default: the HIBP breach check makes an outbound request. */
  breachCheck: boolean
  /** Idle seconds before the vault seals itself. */
  autolockSecs: number
  /** How long a copied secret lingers before the clipboard is cleared (ms). */
  clipboardTimeoutMs: number
  dateFormat: DateFormat
  /** Seed values for every new password, shared with the ⌘G dialog. */
  generator: GeneratorOptions
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  sort: 'recent',
  breachCheck: false,
  autolockSecs: 60,
  clipboardTimeoutMs: 30_000,
  dateFormat: 'MM/DD/YYYY',
  generator: { length: 20, numbers: true, symbols: true, uppercase: true, exclude: '' }
}

const STORAGE_KEY = 'rowel:prefs'

/**
 * Before this store each preference had its own localStorage key. Read them
 * once to seed the first launch on this version; the persisted blob, once it
 * exists, wins over them (see `merge`). They are left in place: harmless, and
 * removing them is a migration a downgrade would regret.
 */
const readLegacy = (): Partial<Prefs> => {
  const legacy: Partial<Prefs> = {}
  try {
    const theme = localStorage.getItem('theme')
    if (theme) legacy.theme = theme as ThemePreference
    const sort = localStorage.getItem('rowel:listSort')
    if (sort) legacy.sort = sort as SortMode
    const breach = localStorage.getItem('rowel:breachCheck')
    if (breach) legacy.breachCheck = breach === 'true'
    const secs = localStorage.getItem('rowel:autolockSecs')
    if (secs) legacy.autolockSecs = Number(secs)
    const clip = localStorage.getItem('rowel:clipboardTimeout')
    if (clip) legacy.clipboardTimeoutMs = Number(clip)
    const format = localStorage.getItem('rowel:dateFormat')
    if (format) legacy.dateFormat = format as DateFormat
    const generator = localStorage.getItem('rowel:generatorDefaults')
    if (generator) legacy.generator = JSON.parse(generator) as GeneratorOptions
  } catch {
    // A locked-down webview or a corrupt value: the defaults stand.
  }
  return legacy
}

const isTheme = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * Stored values are user-writable and may predate a knob added since, so each
 * field is checked and falls back to its default rather than trusted as a
 * whole shape. `generator` is merged one level deep for the same reason.
 */
const sanitize = (raw: Partial<Prefs>): Prefs => {
  const generator = { ...DEFAULT_PREFS.generator, ...(raw.generator ?? {}) }
  return {
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_PREFS.theme,
    sort: raw.sort === 'alpha' ? 'alpha' : 'recent',
    breachCheck: raw.breachCheck === true,
    autolockSecs: isPositive(raw.autolockSecs) ? raw.autolockSecs : DEFAULT_PREFS.autolockSecs,
    clipboardTimeoutMs:
      typeof raw.clipboardTimeoutMs === 'number' &&
      Number.isFinite(raw.clipboardTimeoutMs) &&
      raw.clipboardTimeoutMs >= 0
        ? raw.clipboardTimeoutMs
        : DEFAULT_PREFS.clipboardTimeoutMs,
    dateFormat: DATE_FORMATS.includes(raw.dateFormat as DateFormat)
      ? (raw.dateFormat as DateFormat)
      : DEFAULT_PREFS.dateFormat,
    generator: Number.isFinite(generator.length)
      ? generator
      : { ...generator, length: DEFAULT_PREFS.generator.length }
  }
}

export const usePrefs = create<Prefs>()(
  persist(() => sanitize(readLegacy()), {
    name: STORAGE_KEY,
    merge: (persisted, current) => sanitize({ ...current, ...(persisted as Partial<Prefs>) })
  })
)

export const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]): void => {
  usePrefs.setState({ [key]: value } as Pick<Prefs, K>)
}

// The palette command is a flip, so it resolves "system" first and then lands
// on a concrete light/dark preference.
export const toggleTheme = () => {
  const next: Theme = resolveTheme(usePrefs.getState().theme) === 'dark' ? 'light' : 'dark'
  setPref('theme', next)
}

// The theme is the one preference with a side effect outside React: the
// document root's `data-theme`, which theme.css keys its tokens off.
usePrefs.subscribe((state, previous) => {
  if (state.theme !== previous.theme) applyTheme(state.theme)
})

// "System" has to keep following the OS, not just read it once at startup. No
// matchMedia (jsdom) or a locked-down webview simply means the preference stops
// tracking, which is what it did before anyway.
try {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (usePrefs.getState().theme === 'system') applyTheme('system')
  })
} catch {
  // No subscription; "system" stays on whatever it resolved to at load.
}
