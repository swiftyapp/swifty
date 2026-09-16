import { call } from './client'
import type { GeneratorOptions } from './tools'
import type { BiometricMode, BiometryType, Workspace } from './types'
import type { ThemePreference } from '@/theme'

export type DateFormat = 'MM/DD/YYYY' | 'DD.MM.YYYY' | 'YYYY-MM-DD'

// The order the segmented control offers them in.
export const DATE_FORMATS: DateFormat[] = ['MM/DD/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD']

export type SortMode = 'recent' | 'alpha'

/**
 * Every preference, owned and persisted by Rust (`settings.json` in the app
 * data dir). The unions narrow what Rust stores as plain strings — a value from
 * a hand-edited file that matches no branch is put back to its default by
 * `store/prefs` on the way in.
 */
export interface Settings {
  /** Light by default, dark opt-in, or follow the OS. */
  theme: ThemePreference
  /** The entry list's order. Recency first: the list is a working surface. */
  sort: SortMode
  /** Off by default: the HIBP breach check makes an outbound request. */
  breachCheck: boolean
  /** Idle seconds before the vault seals itself; enforced by Rust. */
  autolockSecs: number
  /** How long a copied secret lingers before the clipboard is cleared (ms). */
  clipboardTimeoutMs: number
  dateFormat: DateFormat
  /** An explicit language choice; null means "follow the OS". */
  locale: string | null
  /** Seed values for every new password, shared with the ⌘G dialog. */
  generator: GeneratorOptions
}

/**
 * Patch one or more preferences. Rust merges the patch over the file, persists
 * it, re-arms the auto-lock when that changed, and hands back the whole result.
 */
export const setSettings = (patch: Partial<Settings>): Promise<Settings> =>
  call('set_settings', { patch })

/**
 * Everything the shell needs to decide what to draw, in one round trip: is
 * there data on disk, which language, whether sync and scanning exist here, and
 * how the biometric gate stands. It was four probes on boot and three more
 * scattered over the app, all of which raced each other.
 */
export interface AppStatus {
  initialized: boolean
  version: string
  /** Every preference, hydrated into the prefs store at boot (`main.tsx`). */
  settings: Settings
  /**
   * The OS locale, already narrowed to a catalog the app ships. Read from the
   * system rather than `navigator.language`, which reports the webview engine's
   * configuration and disagrees with the OS on some Linux and Windows setups.
   */
  locale: string
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
  /**
   * Every workspace on this install, primary first — exactly one until the
   * user makes a second, which is what keeps the whole feature off screen
   * until there is something to switch between.
   */
  workspaces: Workspace[]
  /** Which of them the fields above describe. */
  activeWorkspace: string
}

export const appStatus = (): Promise<AppStatus> => call('app_status')
