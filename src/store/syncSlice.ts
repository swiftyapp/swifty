import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export interface SyncSlice {
  sync: {
    enabled: boolean
    inProgress: boolean
    success: boolean
    error: string | null
    /**
     * ISO time of the last run that actually succeeded, or null if none has in
     * this session. `success` alone cannot answer "has this vault synced yet" —
     * it starts optimistically true, so a freshly connected vault would claim
     * to be up to date before a single run. Null is what separates "nothing has
     * happened yet" from "up to date as of then".
     */
    lastSyncedAt: string | null
  }
  syncInit: (enabled: boolean) => void
  syncConnected: () => void
  syncDisconnected: () => void
  syncStart: () => void
  syncStop: (payload: { success: boolean; error?: string }) => void
}

export const createSyncSlice: StateCreator<StoreState, [], [], SyncSlice> = set => ({
  sync: { enabled: false, inProgress: false, success: true, error: null, lastSyncedAt: null },
  syncInit: enabled => set(s => ({ sync: { ...s.sync, enabled } })),
  syncConnected: () => set(s => ({ sync: { ...s.sync, enabled: true, success: true, error: null } })),
  // Disconnecting drops the timestamp with it: the next connection is a new
  // pairing, and "synced 3m ago" from a previous one would be a lie about it.
  syncDisconnected: () =>
    set(s => ({ sync: { ...s.sync, enabled: false, lastSyncedAt: null } })),
  syncStart: () => set(s => ({ sync: { ...s.sync, inProgress: true, success: true, error: null } })),
  syncStop: payload =>
    set(s => ({
      sync: {
        ...s.sync,
        inProgress: false,
        success: payload.success,
        error: payload.error ?? null,
        // A failed run leaves the previous success standing -- the vault is
        // still current as of whenever it last landed.
        lastSyncedAt: payload.success ? new Date().toISOString() : s.sync.lastSyncedAt
      }
    }))
})
