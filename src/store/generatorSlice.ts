import type { StateCreator } from 'zustand'
import type { SshKeyPair } from '@/lib/commands'
import type { StoreState } from './index'

// Receives the generated value when the user confirms. The login form supplies
// one to fill its password field; the standalone ⌘G flow leaves it null and the
// dialog just copies.
export type GeneratorApply = (value: string) => void

// The SSH counterpart: a key is three draft fields, not one string, so the
// ssh editor's Generate button takes the whole pair. Opening this way also
// picks the dialog's mode — there is nothing else to generate from that row.
export type SshApply = (pair: SshKeyPair) => void

interface Generator {
  open: boolean
  apply: GeneratorApply | null
  ssh: SshApply | null
}

export interface GeneratorSlice {
  generator: Generator
  openGenerator: (apply?: GeneratorApply) => void
  openSshGenerator: (ssh: SshApply) => void
  closeGenerator: () => void
}

const CLOSED: Generator = { open: false, apply: null, ssh: null }

export const createGeneratorSlice: StateCreator<
  StoreState,
  [],
  [],
  GeneratorSlice
> = set => ({
  generator: CLOSED,
  openGenerator: apply => set({ generator: { ...CLOSED, open: true, apply: apply ?? null } }),
  openSshGenerator: ssh => set({ generator: { ...CLOSED, open: true, ssh } }),
  closeGenerator: () => set({ generator: CLOSED })
})
