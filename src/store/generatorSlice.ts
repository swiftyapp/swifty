import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

// Receives the generated value when the user confirms. The login form supplies
// one to fill its password field; the standalone ⌘G flow leaves it null and the
// dialog just copies.
export type GeneratorApply = (value: string) => void

export interface GeneratorSlice {
  generator: { open: boolean; apply: GeneratorApply | null }
  openGenerator: (apply?: GeneratorApply) => void
  closeGenerator: () => void
}

export const createGeneratorSlice: StateCreator<
  StoreState,
  [],
  [],
  GeneratorSlice
> = set => ({
  generator: { open: false, apply: null },
  openGenerator: apply => set({ generator: { open: true, apply: apply ?? null } }),
  closeGenerator: () => set({ generator: { open: false, apply: null } })
})
