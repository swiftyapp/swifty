import { call } from './client'
import type { BiometricMode, UnlockResult } from './types'

export const unlock = (password: string): Promise<UnlockResult> =>
  call('unlock', { password })

export const lock = (): Promise<void> => call('lock')

/**
 * The user is at the keyboard: restart the inactivity clock. Rust arms the
 * auto-lock for the whole of an unlocked session and re-arms it on every one
 * of these, so the vault seals `autolockSecs` after the last sign of the user
 * — wherever the window is. Sent throttled by `useActivityPing`.
 */
export const touchActivity = (): Promise<void> => call('touch_activity')

export const unlockBiometric = (): Promise<UnlockResult> => call('unlock_biometric')

/**
 * Opt in/out of biometric unlock. `enable` stores the current session key in the
 * OS secure store (biometry-gated) and resolves with the mode enrollment settled
 * on; `disable` deletes it. Requires an unlocked vault.
 */
export const enableBiometric = (): Promise<BiometricMode> => call('enable_biometric')

export const disableBiometric = (): Promise<void> => call('disable_biometric')

export const changeMasterPassword = (current: string, next: string): Promise<void> =>
  call('change_master_password', { current, new: next })
