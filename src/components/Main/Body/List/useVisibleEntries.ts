import { useMemo } from 'react'
import type { EntryMeta } from '@/api/types'
import { useUi, useVault, usePrefs } from '@/store'
import { scopeEntries, searchIndex, searchEntries } from '@/services/entries'
import { byTitle, byRecency, byCreated, byKind } from './order'

/**
 * The rows the current view is *about*, before search and the kind scope.
 *
 * One definition for all the item views, so a view is only ever a different
 * source array — never a second filter path. Everything downstream (the list,
 * the empty states) reads the vault through here. Tags reads the whole vault:
 * a tag gathers items from across it, not from one view.
 */
export const useRows = (): EntryMeta[] => {
  const view = useUi(state => state.view)
  const items = useVault(state => state.items)
  const archive = useVault(state => state.archive)
  // Memoized so every branch hands back a stable reference — callers put these
  // rows in `useMemo` deps.
  const favorites = useMemo(() => items.filter(entry => entry.favorite), [items])

  if (view === 'archive') return archive
  if (view === 'favorites') return favorites
  return items
}

// Search results come ranked, so they are never sectioned.
export const useGrouped = (): boolean => {
  const query = useUi(state => state.query)
  return !query.trim()
}

// The rows the list shows, sectioned by kind here so the keyboard walks them
// in the order they are drawn. Memoized: the whole column reads it.
export const useVisibleEntries = () => {
  const type = useUi(state => state.filterType)
  // A tag narrows the Tags view and nothing else — `setView` already drops it
  // on the way out, and this is what makes the other views immune regardless.
  const tag = useUi(state => (state.view === 'tags' ? state.filterTag : null))
  const query = useUi(state => state.query)
  const sort = usePrefs(state => state.sort)
  const grouped = useGrouped()
  const rows = useRows()

  const scoped = useMemo(() => scopeEntries(rows, { type, tag }), [rows, type, tag])
  // One index per set of rows, searched on every keystroke: rebuilt when the
  // rows or the scope change, not when the query does.
  const index = useMemo(() => searchIndex(scoped), [scoped])

  return useMemo(() => {
    // A query comes back ranked by relevance; re-sorting it would throw the
    // ranking away and bury the closest match under whatever is newest.
    const trimmed = query.trim()
    if (trimmed) return searchEntries(index, trimmed)
    const ordered =
      sort === 'alpha' ? byTitle(scoped) : sort === 'created' ? byCreated(scoped) : byRecency(scoped)
    return grouped ? byKind(ordered) : ordered
  }, [scoped, index, query, sort, grouped])
}
