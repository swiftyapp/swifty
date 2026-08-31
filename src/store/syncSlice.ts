import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export interface SyncSlice {
  sync: { enabled: boolean; inProgress: boolean; success: boolean; error: string | null }
  syncInit: (enabled: boolean) => void
  syncConnected: () => void
  syncDisconnected: () => void
  syncStart: () => void
  syncStop: (payload: { success: boolean; error?: string }) => void
}

export const createSyncSlice: StateCreator<StoreState, [], [], SyncSlice> = set => ({
  sync: { enabled: false, inProgress: false, success: true, error: null },
  syncInit: enabled => set(s => ({ sync: { ...s.sync, enabled } })),
  syncConnected: () => set(s => ({ sync: { ...s.sync, enabled: true, success: true, error: null } })),
  syncDisconnected: () => set(s => ({ sync: { ...s.sync, enabled: false } })),
  syncStart: () => set(s => ({ sync: { ...s.sync, inProgress: true, success: true, error: null } })),
  syncStop: payload =>
    set(s => ({
      sync: { ...s.sync, inProgress: false, success: payload.success, error: payload.error ?? null }
    }))
})
