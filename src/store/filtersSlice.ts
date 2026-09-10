import type { StateCreator } from 'zustand'
import type { EntryType } from '@/lib/commands'
import type { StoreState } from './index'

export interface FiltersSlice {
  // `type: null` is "All Items" — the list shows every kind. The type filter is
  // a filter and nothing else: it no longer doubles as navigation or as the
  // kind of a new entry.
  // `tag` is what the Tags view shows: the items carrying it, from across the
  // vault. Only that view holds one — `showTag` sets it with the view and
  // `setView` clears it — and it still composes with the kind filter and the
  // query.
  filters: { type: EntryType | null; tag: string | null; query: string }
  setFilterQuery: (query: string) => void
  setFilterType: (type: EntryType | null) => void
  setFilterTag: (tag: string | null) => void
}

// A selection the new filter still shows is kept — narrowing to the kind you
// are already reading shouldn't close it. Only a selection the filter would
// hide is dropped, along with any in-progress new/edit.
const afterFilter = (state: StoreState, hidden: boolean) =>
  hidden ? { ...state.entries, new: null, edit: false, current: null } : state.entries

export const createFiltersSlice: StateCreator<StoreState, [], [], FiltersSlice> = set => ({
  filters: { type: null, tag: null, query: '' },
  setFilterQuery: query => set(s => ({ filters: { ...s.filters, query } })),
  setFilterType: type =>
    set(s => {
      const current = s.entries.current
      return {
        filters: { ...s.filters, type },
        entries: afterFilter(s, !!type && !!current && current.type !== type)
      }
    }),
  setFilterTag: tag =>
    set(s => {
      const current = s.entries.current
      return {
        filters: { ...s.filters, tag },
        entries: afterFilter(s, !!tag && !!current && !current.tags.includes(tag))
      }
    })
})
