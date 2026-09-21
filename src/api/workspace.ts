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
 * Remove a workspace's vault from this device. `password` is that workspace's
 * own master password — a locked workspace's key is nowhere in memory, so the
 * backend derives from its descriptor and lets the database answer; a wrong one
 * rejects as `invalidPassword` and nothing is removed.
 *
 * Local by default: whatever the vault has on Google Drive is left there, so
 * the account still holds it and it can be restored as a workspace again. With
 * `everywhere`, the vault's copy on Drive goes first and a marker takes its
 * place, which is what has the account's other devices stop syncing it instead
 * of uploading theirs back — and the Drive step runs before anything local is
 * removed, so a network failure leaves the workspace here to try again from.
 *
 * Refused as `lastWorkspace` when it is the only workspace left. Deleting the
 * active one ends its session, so `vault:locked` arrives and the app comes back
 * on the survivor's lock screen — there is nothing to do with this promise but
 * report what went wrong.
 */
export const workspaceDelete = (
  id: string,
  password: string,
  everywhere: boolean
): Promise<void> => call('workspace_delete', { id, password, everywhere })

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
