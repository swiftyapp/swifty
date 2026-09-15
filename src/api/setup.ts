import { call } from './client'
import type { UnlockResult } from './types'

/**
 * The sealed pack this Google account already holds, as the setup probe reports
 * it. `size` is bytes; `modifiedTime` is RFC3339.
 */
export interface SetupDriveFile {
  name: string
  size: number
  modifiedTime: string
}

/**
 * Start the Google consent flow *before* there is anything on disk, so the
 * first run can look for data to restore. The outcome never arrives through
 * this promise: it comes back as `setup:drive:pending` and then exactly one of
 * `setup:drive:probed` / `setup:drive:error`. A rejection here is an immediate
 * failure (no OAuth client configured) and is shown the same way an error event
 * is.
 */
export const setupDriveConnect = (): Promise<void> => call('setup_drive_connect')

/** Forget the tokens `setupDriveConnect` left pending (Go back, Switch account). */
export const setupDriveDisconnect = (): Promise<void> => call('setup_drive_disconnect')

/** Pull the pack the probe found and unseal it here. Resolves `syncConfigured: true`. */
export const setupRestoreFromDrive = (password: string): Promise<UnlockResult> =>
  call('setup_restore_from_drive', { password })

/**
 * Create the local data under `password`. Any tokens left pending by
 * `setupDriveConnect` are adopted, so the result reports sync as configured;
 * `archiveRemote` renames the pack already in that Drive folder first, rather
 * than writing over it.
 */
export const setupCreate = (
  password: string,
  archiveRemote: boolean
): Promise<UnlockResult> => call('setup_create', { password, archiveRemote })

/**
 * First run only: install a `.rowel` backup as this device's vault. The same
 * pack Drive holds, so it fails the same ways as `setupRestoreFromDrive`.
 */
export const setupRestoreFromFile = (
  path: string,
  password: string
): Promise<UnlockResult> => call('setup_restore_from_file', { path, password })
