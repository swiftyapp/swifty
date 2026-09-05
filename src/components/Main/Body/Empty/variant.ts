import { useStore } from '@/store'
import { useRows, useVisibleEntries } from '../List/useVisibleEntries'

/**
 * Every way the two content panes can have nothing to show.
 *
 * `vault`, `health`, `favorites` and `archive` are whole-view states and own the
 * detail pane's hero; `kind` and `search` are filter states and belong to the
 * list column, which leaves the detail pane on the quiet `select`. Deciding all
 * of it here is what keeps the two panes from ever showing a hero at the same
 * time.
 */
export type Variant = 'vault' | 'kind' | 'search' | 'select' | 'health' | 'favorites' | 'archive'

const WHOLE_VIEW: Variant[] = ['vault', 'health', 'favorites', 'archive']

/**
 * Whether a variant is a whole-view state rather than a filter one. The wide
 * shell always has a detail pane to put these in; the compact shell has only
 * the list, so it asks this before showing the hero there itself.
 */
export const isWholeView = (variant: Variant) => WHOLE_VIEW.includes(variant)

// Which empty state the app is in, or `null` when there is real content to
// show — which, for the surfaces that ask, only ever means a scored audit.
export const useVariant = (): Variant | null => {
  const view = useStore(state => state.ui.view)
  const audit = useStore(state => state.audit)
  const query = useStore(state => state.filters.query)
  const rows = useRows()
  // The same filtered set the list renders, rather than a second pass over it:
  // only its size matters here.
  const visible = useVisibleEntries()

  // Health is its own surface: it scores logins, not the filtered list, so the
  // item-side filters never apply. A null audit is still being computed.
  if (view === 'health') return audit && Object.keys(audit).length === 0 ? 'health' : null

  // Nothing to filter means the view itself is empty, and each view says so in
  // its own words — "no favorites yet" is not "your vault is empty".
  if (rows.length === 0) return view === 'items' ? 'vault' : view
  if (visible.length > 0) return 'select'
  return query.trim() ? 'search' : 'kind'
}
