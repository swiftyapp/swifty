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
