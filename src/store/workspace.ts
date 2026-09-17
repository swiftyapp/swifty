import type { Workspace } from '@/api/types'
import { workspaceCreate, workspaceRestoreFromDrive, workspaceSelect } from '@/api/workspace'
import { PRIMARY_WORKSPACE } from '@/lib/workspace'
import {
  useApp,
  clearSession,
  enterMain,
  refreshApp,
  forgetBiometricGate,
  setupDriveRestoring,
  setupDriveRestoreFailed,
  type AppState
} from './app'

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

// Move to another workspace. Only one is ever unlocked, so this *is* a lock —
// and the backend emits `vault:locked` for it like any other, so there is
// nothing to do here afterwards: the one handler re-probes and lands on that
// workspace's lock screen with the picker still offering the way back.
//
// The gate is dropped first: it belongs to the workspace being left, and the
// lock screen would otherwise wear it for the new one until the re-probe lands
// (see `forgetBiometricGate`). A switch that fails re-probes to put it back.
export const switchWorkspace = (id: string) => {
  forgetBiometricGate()
  return workspaceSelect(id).catch((error: unknown) => {
    void refreshApp()
    throw error
  })
}

// Create a workspace and open it. It arrives active and unlocked, so this is an
// unlock rather than a first run — but of a different database, so the session
// data of the one being left has to go first, exactly as a lock would drop it.
// The re-probe is what brings the new list on screen: which workspaces exist
// and which is active is the probe's answer, and this is the one move that
// changes it without passing through a lock.
export const createWorkspace = async (name: string, password: string) => {
  const result = await workspaceCreate(name, password)
  clearSession()
  await enterMain(result)
  await refreshApp()
}

// Add a workspace by restoring one of the connected account's other vaults.
// The same landing as a create — it arrives active and unlocked, so the
// previous workspace's data goes first and the probe brings the new list on
// screen — and the same landing as the first run's restore too: the result says
// `syncConfigured`, which is what has `enterMain` run the first sync.
//
// The store, not the form, says a restore is running: the backend has claimed
// the pending account for its length and refuses to give it up, so every
// control that would (Cancel, Switch account) has to know to stand down — and
// the form is not the only thing drawing them.
export const restoreWorkspaceFromDrive = async (
  name: string,
  password: string,
  fileId: string
) => {
  setupDriveRestoring()
  let result
  try {
    result = await workspaceRestoreFromDrive(name, password, fileId)
  } catch (error) {
    setupDriveRestoreFailed()
    throw error
  }
  clearSession()
  await enterMain(result)
  await refreshApp()
}
