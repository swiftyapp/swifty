import type { StateCreator } from 'zustand'
import type { Workspace } from '@/api/types'
import { PRIMARY_WORKSPACE } from '@/lib/workspace'
import type { StoreState } from './index'

export interface WorkspaceSlice {
  /**
   * Which encrypted databases exist and which one is active — answered by
   * `app_status`, so it is known while locked. Session-shaped: a lock does not
   * clear it, because the lock screen it lands on is exactly where the list is
   * needed to switch again.
   *
   * Empty until the first probe answers, which is what keeps the picker and the
   * header label off screen on launch instead of flashing a one-item list.
   */
  workspaces: { list: Workspace[]; active: string }
  setWorkspaces: (list: Workspace[], active: string) => void
}

export const createWorkspaceSlice: StateCreator<StoreState, [], [], WorkspaceSlice> = set => ({
  workspaces: { list: [], active: PRIMARY_WORKSPACE },
  setWorkspaces: (list, active) => set({ workspaces: { list, active } })
})
