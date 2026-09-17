import { call } from './client'
import type { UnlockResult } from './types'

/**
 * One sealed `.rowel` pack this Google account already holds, as the setup
 * probe reports it. `size` is bytes; `modifiedTime` is RFC3339.
 *
 * An account can hold several — two installs syncing their own primary vault
 * to one account each mint their own vault id — so the probe lists them all and
 * the user says which is theirs. `id` is the Drive file id, and the only thing
 * that names that choice back to the backend.
 *
 * `name` is the file's name in `Rowel/Vaults/`: the vault's own id, not a label
 * the user chose, so it is not shown. `vaultId` is that same id parsed out —
 * always present, since a file whose name carries no id is not a pack at all.
 */
export interface SetupDriveFile {
  id: string
  name: string
  vaultId: string
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

/**
 * Pull the pack the user chose out of the ones the probe listed, and unseal it
 * here. Resolves `syncConfigured: true`. `fileId` is that pack's Drive file id;
 * one the account no longer holds fails as `noRemoteVault`.
 */
export const setupRestoreFromDrive = (
  password: string,
  fileId: string
): Promise<UnlockResult> => call('setup_restore_from_drive', { password, fileId })

/**
 * Create the local data under `password`. Any tokens left pending by
 * `setupDriveConnect` are adopted, so the result reports sync as configured.
 * A vault the account already holds is left alone: this one gets its own id,
 * and syncs to its own pack beside it.
 */
export const setupCreate = (password: string): Promise<UnlockResult> =>
  call('setup_create', { password })

/**
 * First run only: install a `.rowel` backup as this device's vault. The same
 * pack Drive holds, so it fails the same ways as `setupRestoreFromDrive`.
 */
export const setupRestoreFromFile = (
  path: string,
  password: string
): Promise<UnlockResult> => call('setup_restore_from_file', { path, password })
