import { call } from './client'
import type { BiometricMode, BiometryType } from './types'

export type DateFormat = 'MM/DD/YYYY' | 'DD.MM.YYYY' | 'YYYY-MM-DD'

// The order the segmented control offers them in.
export const DATE_FORMATS: DateFormat[] = ['MM/DD/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD']

export type SortMode = 'recent' | 'alpha'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

/** The seed values for every new password, shared with the ⌘G dialog. */
export interface GeneratorDefaults {
  length: number
  numbers: boolean
  symbols: boolean
  uppercase: boolean
  exclude: string
  excludeSimilarCharacters: boolean
}

/**
 * Every preference, owned and persisted by Rust (`settings.json` in the app
 * data dir). The unions narrow what Rust stores as plain strings — a value from
 * a hand-edited file that matches no branch falls through the same way the
 * default does.
 */
export interface Settings {
  autolockSecs: number
  clipboardTimeoutMs: number
  dateFormat: DateFormat
  listSort: SortMode
  theme: ThemePreference
  /** An explicit language choice; null means "follow the OS". */
  locale: string | null
  breachCheck: boolean
  generator: GeneratorDefaults
}

/**
 * Everything the shell needs to decide what to draw, in one round trip: is
 * there data on disk, which language, whether sync and scanning exist here, and
 * how the biometric gate stands. It was four probes on boot and three more
 * scattered over the app, all of which raced each other.
 */
export interface AppStatus {
  initialized: boolean
  version: string
  /**
   * The locale to open in: the stored choice, or the OS narrowed to a catalog
   * the app ships. Read from the system rather than `navigator.language`, which
   * reports the webview engine's configuration and disagrees with the OS on
   * some Linux and Windows setups.
   */
  locale: string
  /** Every preference, hydrated into the store at boot (`settingsSlice`). */
  settings: Settings
  syncConfigured: boolean
  /** A consent flow is out with the browser (see `sync:pending` in events.ts). */
  syncPending: boolean
  /**
   * Whether this platform has a text recognizer at all. False on Linux and on a
   * Windows without an OCR language pack, where the UI offers no scanning.
   */
  scanSupported: boolean
  biometric: {
    /** Enrolled *and* usable right now. */
    available: boolean
    /**
     * Whether enrolling would work on this device (gated store + hardware),
     * before anyone has enrolled. `available` also demands an enrollment, so on
     * a fresh install it can only ever say no — this is what onboarding asks.
     */
    canEnroll: boolean
    type: BiometryType
    mode: BiometricMode | null
  }
}

export const appStatus = (): Promise<AppStatus> => call('app_status')

// Patch one or more preferences. The whole merged object comes back, so the
// caller ends up holding exactly what was written rather than its own guess.
export const setSettings = (patch: Partial<Settings>): Promise<Settings> =>
  call('set_settings', { patch })
