import { call } from './client'
import type { BiometricMode, BiometryType } from './types'

/**
 * Everything the shell needs to decide what to draw, in one round trip: is
 * there data on disk, whether sync and scanning exist here, and how the
 * biometric gate stands. It was four probes on boot and three more scattered
 * over the app, all of which raced each other.
 */
export interface AppStatus {
  initialized: boolean
  version: string
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
