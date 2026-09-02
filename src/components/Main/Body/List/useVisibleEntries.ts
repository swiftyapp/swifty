import { useStore } from '@/store'
import { filterEntries } from '@/services/entries'
import { byTitle, byRecency } from './order'

// The rows the list column is showing, in render order. One definition of
// "what is visible" for the list itself and for the search field's ⏎ / ⌘⏎
// accelerators, which act on the first of them.
export const useVisibleEntries = () => {
  const type = useStore(state => state.filters.type)
  const query = useStore(state => state.filters.query)
  const items = useStore(state => state.entries.items)
  const sort = useStore(state => state.sort)

  const entries = filterEntries(items, { type, query })
  return sort === 'alpha' ? byTitle(entries) : byRecency(entries)
}
