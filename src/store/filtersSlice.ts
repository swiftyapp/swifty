import type { StateCreator } from 'zustand'
import type { EntryType } from '@/lib/commands'
import type { StoreState } from './index'

export interface FiltersSlice {
  // `type: null` is "All Items" — the list shows every kind. The type filter is
  // a filter and nothing else: it no longer doubles as navigation or as the
  // kind of a new entry.
  filters: { type: EntryType | null; query: string; tags: string[] }
  setFilterQuery: (query: string) => void
  setFilterType: (type: EntryType | null) => void
  setFilterTag: (tag: string) => void
  unsetFilterTag: () => void
}

export const createFiltersSlice: StateCreator<StoreState, [], [], FiltersSlice> = set => ({
  filters: { type: null, query: '', tags: [] },
  setFilterQuery: query => set(s => ({ filters: { ...s.filters, query } })),
  // A selection the new filter still shows is kept — narrowing to the kind you
  // are already reading shouldn't close it. Only a selection the filter would
  // hide is dropped, along with any in-progress new/edit.
  setFilterType: type =>
    set(s => {
      const current = s.entries.current
      const hidden = !!type && !!current && current.type !== type
      return {
        filters: { ...s.filters, type },
        entries: hidden
          ? { ...s.entries, new: null, edit: false, current: null }
          : s.entries
      }
    }),
  setFilterTag: tag => set(s => ({ filters: { ...s.filters, tags: [tag] } })),
  unsetFilterTag: () => set(s => ({ filters: { ...s.filters, tags: [] } }))
})
