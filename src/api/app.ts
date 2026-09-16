import { call } from './client'
import type { BiometricMode, BiometryType, Workspace } from './types'

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
  /**
   * Every workspace on this install, primary first, and which one is active.
   * One entry is the ordinary case — the UI shows nothing about workspaces
   * until there are two. Read on every probe: a rename or a create changes it,
   * and so does a relaunch, which lands on whichever was left active.
   */
  workspaces: Workspace[]
  activeWorkspace: string
  biometric: {
    /** Enrolled *and* usable right now. */
    available: boolean
    /**
     * Whether enrolling would work on this device (gated store + hardware),
     * before anyone has enrolled. `available` also demands an enrollment, so on
     * a fresh install it can only ever say no — this is what onboarding asks.
     * Always false outside the primary workspace, which holds the one
     * enrollment.
     */
    canEnroll: boolean
    type: BiometryType
    mode: BiometricMode | null
  }
}

export const appStatus = (): Promise<AppStatus> => call('app_status')
