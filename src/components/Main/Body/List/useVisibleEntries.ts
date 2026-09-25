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
 * the scope counts, the empty states) reads the vault through here. Tags reads
 * the whole vault: a tag gathers items from across it, not from one view.
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

/**
 * Whether the list is sectioned by kind right now: the list is mixed (no kind
 * is open — one section would be no sections) and nothing is being searched
 * (results come ranked, and sectioning would bury the closest match under
 * whichever kind sorts first). Not a preference: a mixed list is always the
 * map of the kinds in it.
 */
export const useGrouped = (): boolean => {
  const type = useUi(state => state.filterType)
  const query = useUi(state => state.query)
  return type === null && !query.trim()
}

// The rows the list actually shows: the view's rows, narrowed by the open
// kind, the Tags view's picked tag and the query, in the order the sort control
// asks for — and, in a mixed list, in kind sections in that order. The
// sections are applied here rather than by the list so the keyboard walks the
// rows in the order they are drawn. Memoized because the whole column (the
// list, the empty states) reads it — one pass per keystroke.
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
