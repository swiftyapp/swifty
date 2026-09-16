import type { Workspace } from '@/api/types'
import { workspaceCreate, workspaceSelect } from '@/api/workspace'
import { PRIMARY_WORKSPACE } from '@/lib/workspace'
import { useApp, lockVault, clearSession, enterMain, type AppState } from './app'

/**
 * Workspaces are not state of their own: the launch probe reports which exist
 * and which is active, and `app.status` already holds that answer whole. These
 * are the selectors over it and the two moves — switching and creating — that
 * change it.
 */

const NONE: Workspace[] = []

export const selectWorkspaces = (state: AppState): Workspace[] =>
  state.status?.workspaces ?? NONE

export const selectActiveWorkspace = (state: AppState): string =>
  state.status?.activeWorkspace ?? PRIMARY_WORKSPACE

/** Sync and biometric unlock are offered here and nowhere else. */
export const useIsPrimaryWorkspace = () => useApp(selectActiveWorkspace) === PRIMARY_WORKSPACE

// Move to another workspace. Only one is ever unlocked, so this is a lock:
// mark the other active, then take the ordinary lock path, which re-probes and
// lands on that workspace's lock screen with the picker still offering the way
// back.
export const switchWorkspace = (id: string) => workspaceSelect(id).then(lockVault)

// Create a workspace and open it. It arrives active and unlocked, so this is an
// unlock rather than a first run — but of a different database, so the session
// data of the one being left has to go first, exactly as a lock would drop it.
// `enterMain` re-probes, which is what brings the new list on screen.
export const createWorkspace = async (name: string, password: string) => {
  const result = await workspaceCreate(name, password)
  clearSession()
  await enterMain(result)
}
