import type { StateCreator } from 'zustand'
import type { SetupDriveFile } from '@/lib/commands'
import type { StoreState } from './index'

/**
 * `pending` — consent is out with the browser
 * `found`   — the probe came back with a pack to restore
 * `empty`   — the probe came back with nothing; the account is usable, just bare
 * `error`   — the connect or the probe failed
 */
export type SetupDriveStatus = 'idle' | 'pending' | 'found' | 'empty' | 'error'

export interface SetupSlice {
  /**
   * The first run's Drive probe, which has no vault behind it yet — so it
   * cannot live in `sync`, whose `enabled` means "this vault syncs". Both the
   * restore screen and the create flow's second step read it: they ask the same
   * question of the same account and only differ in what they do with the
   * answer.
   */
  setup: {
    drive: {
      status: SetupDriveStatus
      file: SetupDriveFile | null
      error: string | null
    }
  }
  setupDrivePending: () => void
  setupDriveProbed: (file: SetupDriveFile | null) => void
  setupDriveFailed: (error: string) => void
  setupDriveReset: () => void
}

const idle = { status: 'idle' as SetupDriveStatus, file: null, error: null }

export const createSetupSlice: StateCreator<StoreState, [], [], SetupSlice> = set => ({
  setup: { drive: idle },
  setupDrivePending: () =>
    set({ setup: { drive: { status: 'pending', file: null, error: null } } }),
  setupDriveProbed: file =>
    set({ setup: { drive: { status: file ? 'found' : 'empty', file, error: null } } }),
  setupDriveFailed: error => set({ setup: { drive: { status: 'error', file: null, error } } }),
  setupDriveReset: () => set({ setup: { drive: idle } })
})
