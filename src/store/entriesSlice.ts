import type { StateCreator } from 'zustand'
import type { Entry } from '@/lib/commands'
import type { StoreState } from './index'

export interface EntriesSlice {
  entries: { new: boolean; edit: boolean; current: Entry | null; items: Entry[] }
  newEntry: () => void
  setNoEntry: () => void
  editEntry: () => void
  setEntries: (items: Entry[]) => void
  setCurrentEntry: (id: string) => void
  entrySaved: (id: string) => void
  entryRemoved: (items: Entry[]) => void
}

const find = (items: Entry[], id?: string) =>
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
