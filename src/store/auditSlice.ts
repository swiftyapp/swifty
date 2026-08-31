import type { StateCreator } from 'zustand'
import type { Audit } from '@/lib/commands'
import type { StoreState } from './index'

export interface AuditSlice {
  audit: Audit | null
  auditDone: (audit: Audit) => void
}

export const createAuditSlice: StateCreator<StoreState, [], [], AuditSlice> = set => ({
  audit: null,
  auditDone: audit => set({ audit })
})
