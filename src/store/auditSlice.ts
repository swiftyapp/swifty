import type { StateCreator } from 'zustand'
import type { Audit } from '@/lib/commands'
import { getBreachCheck, setBreachCheck } from '@/defaults/audit'
import type { StoreState } from './index'

export interface AuditSlice {
  audit: Audit | null
  breachCheck: boolean
  auditDone: (audit: Audit) => void
  setBreachCheck: (on: boolean) => void
}

export const createAuditSlice: StateCreator<StoreState, [], [], AuditSlice> = set => ({
  audit: null,
  breachCheck: getBreachCheck(),
  auditDone: audit => set({ audit }),
  setBreachCheck: on => {
    setBreachCheck(on)
    set({ breachCheck: on })
  }
})
