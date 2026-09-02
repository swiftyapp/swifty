import { useStore } from '@/store'
import { filterEntries } from '@/services/entries'
import Item from './Item'
import Empty from './Empty'
import { byTitle, byRecency } from './order'

// A flat list in either order — retrieval here is by name or search, so date
// buckets earn nothing (the audit list keeps its severity groups, which do).
export default function Manager() {
  const type = useStore(state => state.filters.type)
  const query = useStore(state => state.filters.query)
  const items = useStore(state => state.entries.items)
  const sort = useStore(state => state.sort)

  const entries = filterEntries(items, { type, query })

  if (entries.length === 0) return <Empty />

  const ordered = sort === 'alpha' ? byTitle(entries) : byRecency(entries)

  return (
    <div className="pb-6">
      {ordered.map(entry => (
        <Item entry={entry} key={entry.id} />
      ))}
    </div>
  )
}
