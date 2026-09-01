export type SortMode = 'recent' | 'alpha'

const KEY = 'swifty:listSort'

// Recency first: the list is a working surface, so the things you touched last
// should be at the top until you say otherwise.
export const getSortMode = (): SortMode =>
  localStorage.getItem(KEY) === 'alpha' ? 'alpha' : 'recent'

export const setSortMode = (mode: SortMode) => localStorage.setItem(KEY, mode)
