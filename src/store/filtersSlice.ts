import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export type Scope = 'login' | 'note' | 'card' | 'audit'

export interface FiltersSlice {
  filters: { scope: Scope; query: string; tags: string[] }
  setFilterQuery: (query: string) => void
  setFilterScope: (scope: Scope) => void
  setFilterTag: (tag: string) => void
  unsetFilterTag: () => void
}

export const createFiltersSlice: StateCreator<StoreState, [], [], FiltersSlice> = set => ({
  filters: { scope: 'login', query: '', tags: [] },
  setFilterQuery: query => set(s => ({ filters: { ...s.filters, query } })),
  // Switching scope also drops any in-progress new entry and selection.
  setFilterScope: scope =>
    set(s => ({
      filters: { ...s.filters, scope },
      entries: { ...s.entries, new: false, current: null }
    })),
  setFilterTag: tag => set(s => ({ filters: { ...s.filters, tags: [tag] } })),
  unsetFilterTag: () => set(s => ({ filters: { ...s.filters, tags: [] } }))
})
