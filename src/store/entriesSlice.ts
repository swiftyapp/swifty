import type { StateCreator } from 'zustand'
import type { EntryMeta, EntryType } from '@/lib/commands'
import type { StoreState } from './index'

export interface EntriesSlice {
  // `new` carries the kind being created (null when nothing is), so the editor
  // no longer has to infer it from whatever the list is filtered to.
  entries: { new: EntryType | null; edit: boolean; current: EntryMeta | null; items: EntryMeta[] }
  newEntry: (type: EntryType) => void
  setNoEntry: () => void
  editEntry: () => void
  setEntries: (items: EntryMeta[]) => void
  setCurrentEntry: (id: string) => void
  entrySaved: (id: string) => void
  entryRemoved: (items: EntryMeta[]) => void
}

const find = (items: EntryMeta[], id?: string) =>
  items.find(item => item.id === id) ?? null

export const createEntriesSlice: StateCreator<StoreState, [], [], EntriesSlice> = (set, get) => ({
  entries: { new: null, edit: false, current: null, items: [] },
  newEntry: type =>
    set(s => ({ entries: { ...s.entries, new: type, edit: false, current: null } })),
  setNoEntry: () => set(s => ({ entries: { ...s.entries, new: null, edit: false, current: null } })),
  editEntry: () => set(s => ({ entries: { ...s.entries, edit: true, new: null } })),
  setEntries: items => set(s => ({ entries: { ...s.entries, items } })),
  setCurrentEntry: id =>
    set(s => ({
      entries: { ...s.entries, current: find(get().entries.items, id), new: null, edit: false }
    })),
  entrySaved: id =>
    set(s => ({
      entries: { ...s.entries, edit: false, new: null, current: find(get().entries.items, id) }
    })),
  entryRemoved: items =>
    set(s => ({ entries: { ...s.entries, items, new: null, edit: false, current: null } }))
})
