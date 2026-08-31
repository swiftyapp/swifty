import type { StateCreator } from 'zustand'
import { getSortMode, setSortMode, type SortMode } from '@/defaults/list'
import type { StoreState } from './index'

export interface ListSlice {
  sort: SortMode
  setSort: (mode: SortMode) => void
}

// The entry list's sort order. A UI preference, so it persists across launches
// the way the theme and the breach-check toggle do.
export const createListSlice: StateCreator<StoreState, [], [], ListSlice> = set => ({
  sort: getSortMode(),
  setSort: mode => {
    setSortMode(mode)
    set({ sort: mode })
  }
})
