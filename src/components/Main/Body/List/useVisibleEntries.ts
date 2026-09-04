import { useMemo } from 'react'
import type { EntryMeta } from '@/lib/commands'
import { useStore } from '@/store'
import { filterEntries } from '@/services/entries'
import { byTitle, byRecency } from './order'

/**
 * The rows the current view is *about*, before search and the kind chips.
 *
 * One definition for all three item views, so a view is only ever a different
 * source array — never a second filter path. Everything downstream (the list,
 * the chip counts, the empty states) reads the vault through here.
 */
export const useRows = (): EntryMeta[] => {
  const view = useStore(state => state.ui.view)
  const items = useStore(state => state.entries.items)
  const trash = useStore(state => state.entries.trash)
  // Memoized so every branch hands back a stable reference — callers put these
  // rows in `useMemo` deps (see `Header/KindChips`).
  const favorites = useMemo(() => items.filter(entry => entry.favorite), [items])

  if (view === 'trash') return trash
  if (view === 'favorites') return favorites
  return items
}

// The rows the list actually shows: the view's rows, narrowed by the chips, the
// rail's tag filter and the query, in the order the sort control asks for.
// Memoized because the whole column (the list, the empty states) reads it — one
// pass per keystroke.
export const useVisibleEntries = () => {
  const type = useStore(state => state.filters.type)
  const tag = useStore(state => state.filters.tag)
  const query = useStore(state => state.filters.query)
  const sort = useStore(state => state.sort)
  const rows = useRows()

  return useMemo(() => {
    const entries = filterEntries(rows, { type, tag, query })
    // A query comes back ranked by relevance; re-sorting it would throw the
    // ranking away and bury the closest match under whatever is newest.
    if (query.trim()) return entries
    return sort === 'alpha' ? byTitle(entries) : byRecency(entries)
  }, [rows, type, tag, query, sort])
}
