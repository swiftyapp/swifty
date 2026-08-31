import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export type FlowName = 'setup' | 'auth' | 'main'

export interface FlowSlice {
  flow: { name: FlowName; touchID: boolean }
  flowSetup: () => void
  flowAuth: (touchID: boolean) => void
  flowMain: () => void
}

export const createFlowSlice: StateCreator<StoreState, [], [], FlowSlice> = set => ({
  // No backend command exists to detect a pristine vault, so we default to the
  // auth screen (see PR report). Setup is reached explicitly via `flowSetup`.
  flow: { name: 'auth', touchID: false },
  flowSetup: () => set(s => ({ flow: { ...s.flow, name: 'setup' } })),
  flowAuth: touchID => set(() => ({ flow: { name: 'auth', touchID } })),
  flowMain: () => set(s => ({ flow: { ...s.flow, name: 'main' } }))
})
