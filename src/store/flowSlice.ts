import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export type FlowName = 'setup' | 'auth' | 'main'

export interface FlowSlice {
  /**
   * Which of the three roots is on screen, and nothing else: what the lock
   * screen draws about biometrics is read off the launch probe (`appSlice`)
   * rather than copied in here at each transition.
   */
  flow: { name: FlowName }
  flowSetup: () => void
  flowAuth: () => void
  flowMain: () => void
}

export const createFlowSlice: StateCreator<StoreState, [], [], FlowSlice> = set => ({
  // No backend command exists to detect a pristine vault, so we default to the
  // auth screen (see PR report). Setup is reached explicitly via `flowSetup`.
  flow: { name: 'auth' },
  flowSetup: () => set({ flow: { name: 'setup' } }),
  flowAuth: () => set({ flow: { name: 'auth' } }),
  flowMain: () => set({ flow: { name: 'main' } })
})
