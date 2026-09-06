import type { StateCreator } from 'zustand'
import type { BiometryType } from '@/lib/commands'
import type { StoreState } from './index'

export type FlowName = 'setup' | 'auth' | 'main'

export interface FlowSlice {
  /**
   * `touchID` is whether biometric unlock is enrolled *and* usable; `biometry`
   * is which gate it is, for the copy. They travel together because the lock
   * screen needs both and neither is worth its own store slice.
   */
  flow: { name: FlowName; touchID: boolean; biometry: BiometryType }
  flowSetup: () => void
  /**
   * Omit `biometry` to keep the last known one: it is a property of the device,
   * so it cannot change between two locks, and only the callers already probing
   * the backend (launch, a manual lock) have a fresh answer to hand.
   */
  flowAuth: (touchID: boolean, biometry?: BiometryType) => void
  flowMain: () => void
}

export const createFlowSlice: StateCreator<StoreState, [], [], FlowSlice> = set => ({
  // No backend command exists to detect a pristine vault, so we default to the
  // auth screen (see PR report). Setup is reached explicitly via `flowSetup`.
  // `touchID: false` means nothing biometric is drawn before the probe answers,
  // so the placeholder `biometry` is never on screen.
  flow: { name: 'auth', touchID: false, biometry: 'touch' },
  flowSetup: () => set(s => ({ flow: { ...s.flow, name: 'setup' } })),
  flowAuth: (touchID, biometry) =>
    set(s => ({ flow: { name: 'auth', touchID, biometry: biometry ?? s.flow.biometry } })),
  flowMain: () => set(s => ({ flow: { ...s.flow, name: 'main' } }))
})
