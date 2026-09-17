import { call } from './client'
import type { UnlockResult } from './types'

/**
 * Additional encrypted databases. Each has its own master password and its own
 * file; only one is ever unlocked, so moving between them goes through the lock
 * screen. Each carries its own Drive connection and syncs its own pack, so sync
 * is offered everywhere; biometric unlock still belongs to the primary, and the
 * backend rejects it elsewhere rather than letting a second vault quietly take
 * over the one enrolled key.
 */

/**
 * Create a workspace under `password` and open it. It comes back already active
 * and unlocked, so the result is an unlock's, not a setup's: the caller has a
 * session to enter main with and a previous workspace's data to drop first.
 */
export const workspaceCreate = (name: string, password: string): Promise<UnlockResult> =>
  call('workspace_create', { name, password })

/**
 * Lock whatever is open and make `id` the active workspace. Persisted, so a
 * relaunch lands on it. Nothing is unlocked afterwards — the caller's next stop
 * is that workspace's lock screen.
 */
export const workspaceSelect = (id: string): Promise<void> =>
  call('workspace_select', { id })

/** Rename a workspace. Metadata only: the vault behind it is untouched. */
export const workspaceRename = (id: string, name: string): Promise<void> =>
  call('workspace_rename', { id, name })

/**
 * Connect a Google account for a workspace that does not exist yet. The
 * onboarding connect with its "no vault here" precondition dropped, so it
 * answers on exactly the same events: `setup:drive:pending`, then one of
 * `setup:drive:probed` / `setup:drive:error`. Nothing comes back through this
 * promise; a rejection is a failure to start at all.
 *
 * The tokens it leaves pending are forgotten with `setupDriveDisconnect`, which
 * both flows share.
 */
export const workspaceDriveConnect = (): Promise<void> => call('workspace_drive_connect')

/**
 * Make a new workspace out of one of the connected account's vaults. `fileId`
 * is the pack the user picked from what the probe listed, `password` is that
 * vault's own master password and `name` is the label the workspace gets here.
 *
 * Resolves like an unlock of the restored vault, with `syncConfigured: true` —
 * the account is sealed under its key by the time this returns. A wrong
 * password rejects as `invalidPassword` and changes nothing, so retrying costs
 * only the typing.
 */
export const workspaceRestoreFromDrive = (
  name: string,
  password: string,
  fileId: string
): Promise<UnlockResult> =>
  call('workspace_restore_from_drive', { name, password, fileId })

/**
 * The same, for one of the vaults the open workspace's own account holds and
 * this device does not (`workspaces:remote`). No sign-in: the open workspace's
 * tokens do the download, and a copy is sealed under the restored vault's key.
 * Refused as `syncNotConfigured` from a workspace that does not sync.
 */
export const workspaceRestoreFromAccount = (
  name: string,
  password: string,
  fileId: string
): Promise<UnlockResult> =>
  call('workspace_restore_from_account', { name, password, fileId })
