import { useStore } from '@/store'
import { filterEntries } from '@/services/entries'

/**
 * Every way the two content panes can have nothing to show.
 *
 * `vault` and `health` are whole-app states and own the detail pane's hero;
 * `kind` and `search` are filter states and belong to the list column, which
 * leaves the detail pane on the quiet `select`. Deciding all of it here is what
 * keeps the two panes from ever showing a hero at the same time.
 */
export type Variant = 'vault' | 'kind' | 'search' | 'select' | 'health'

// Which empty state the app is in, or `null` when there is real content to
// show — which, for the surfaces that ask, only ever means a scored audit.
export const useVariant = (): Variant | null => {
  const view = useStore(state => state.ui.view)
  const audit = useStore(state => state.audit)
  const items = useStore(state => state.entries.items)
  const type = useStore(state => state.filters.type)
  const query = useStore(state => state.filters.query)

  // Health is its own surface: it scores logins, not the filtered list, so the
  // item-side filters never apply. A null audit is still being computed.
  if (view === 'health') return audit && Object.keys(audit).length === 0 ? 'health' : null

  if (items.length === 0) return 'vault'
  if (filterEntries(items, { type, query }).length > 0) return 'select'
  return query.trim() ? 'search' : 'kind'
}
