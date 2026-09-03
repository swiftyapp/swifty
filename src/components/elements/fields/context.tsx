import { createContext, useContext } from 'react'
import type { EntryDraft } from '@/defaults/entries'

export interface FieldsState {
  /** The live draft while editing, the decrypted entry while reading. */
  entry: EntryDraft
  /**
   * Writes one draft key. `null` is the whole mode switch: with no writer
   * every field renders its read face, so no component takes a `mode` prop.
   */
  set: ((name: string, value: string | string[]) => void) | null
  /** Save has been attempted, so required fields may now complain. */
  attempted: boolean
}

const FieldsContext = createContext<FieldsState>({
  entry: { type: 'login', title: '' },
  set: null,
  attempted: false
})

export const FieldsProvider = FieldsContext.Provider

export const useFields = () => useContext(FieldsContext)

export interface FieldHandle {
  value: string
  set: (value: string) => void
  editing: boolean
  attempted: boolean
}

/** One string-valued draft key, with the mode it should render in. */
export const useField = (name: string): FieldHandle => {
  const { entry, set, attempted } = useFields()
  const raw = entry[name]
  return {
    value: typeof raw === 'string' ? raw : '',
    set: value => set?.(name, value),
    editing: !!set,
    attempted
  }
}
