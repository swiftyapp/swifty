import type { StateCreator } from 'zustand'
import type { StoreState } from './index'
import { checkForUpdate } from '@/services/autoUpdate'

export type UpdateCheckStatus = 'checking' | 'uptodate' | 'error' | null

export interface UpdateSlice {
  update: {
    // Version + release notes of a staged update awaiting restart (null = none).
    readyVersion: string | null
    readyNotes: string | null
    // Transient status of a manual update check (null = idle).
    status: UpdateCheckStatus
  }
  // Records a staged update (drives the restart toast).
  setUpdateReady: (version: string, notes: string | null) => void
  // Dismisses the restart toast; the staged update still applies on next launch.
  dismissUpdate: () => void
  // On-demand check with visible feedback for every outcome.
  runUpdateCheck: () => Promise<void>
}

export const createUpdateSlice: StateCreator<StoreState, [], [], UpdateSlice> = (set, get) => ({
  update: { readyVersion: null, readyNotes: null, status: null },

  setUpdateReady: (version, notes) =>
    set(s => ({ update: { ...s.update, readyVersion: version, readyNotes: notes } })),

  dismissUpdate: () =>
    set(s => ({ update: { ...s.update, readyVersion: null, readyNotes: null } })),

  runUpdateCheck: async () => {
    if (get().update.status === 'checking') return
    set(s => ({ update: { ...s.update, status: 'checking' } }))

    const result = await checkForUpdate()
    if (result.kind === 'staged') {
      set(() => ({
        update: { readyVersion: result.version, readyNotes: result.notes, status: null }
      }))
      return
    }

    // Nothing to report on a build without an updater (mobile ships through the
    // App Store); the control that starts a check is hidden there anyway.
    if (result.kind === 'unsupported') {
      set(s => ({ update: { ...s.update, status: null } }))
      return
    }

    const status = result.kind === 'uptodate' ? 'uptodate' : 'error'
    set(s => ({ update: { ...s.update, status } }))
    setTimeout(() => {
      if (get().update.status === status) set(s => ({ update: { ...s.update, status: null } }))
    }, status === 'uptodate' ? 4000 : 6000)
  }
})
