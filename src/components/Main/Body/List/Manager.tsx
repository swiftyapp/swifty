import { useStore } from '@/store'
import { filterEntries } from '@/services/entries'
import Item from './Item'
import Empty from './Empty'

export default function Manager() {
  const tags = useStore(state => state.filters.tags)
  const scope = useStore(state => state.filters.scope)
  const query = useStore(state => state.filters.query)
  const items = useStore(state => state.entries.items)

  const entries = filterEntries(items, { scope, query, tags })

  if (entries.length === 0) return <Empty />

  return (
    <div className="pb-6">
      {entries.map(entry => (
        <Item entry={entry} key={entry.id} />
      ))}
    </div>
  )
}
