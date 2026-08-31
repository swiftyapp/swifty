import type { StateCreator } from 'zustand'
import type { EntryMeta } from '@/lib/commands'
import type { StoreState } from './index'

export interface EntriesSlice {
  entries: { new: boolean; edit: boolean; current: EntryMeta | null; items: EntryMeta[] }
  newEntry: () => void
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
  entries: { new: false, edit: false, current: null, items: [] },
  newEntry: () => set(s => ({ entries: { ...s.entries, new: true, edit: false, current: null } })),
  setNoEntry: () => set(s => ({ entries: { ...s.entries, new: false, edit: false, current: null } })),
  editEntry: () => set(s => ({ entries: { ...s.entries, edit: true, new: false } })),
  setEntries: items => set(s => ({ entries: { ...s.entries, items } })),
  setCurrentEntry: id =>
    set(s => ({
      entries: { ...s.entries, current: find(get().entries.items, id), new: false, edit: false }
    })),
  entrySaved: id =>
    set(s => ({
      entries: { ...s.entries, edit: false, new: false, current: find(get().entries.items, id) }
    })),
  entryRemoved: items =>
    set(s => ({ entries: { ...s.entries, items, new: false, edit: false, current: null } }))
})
