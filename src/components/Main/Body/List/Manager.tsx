import { useStore } from '@/store'
import { filterEntries } from '@/services/entries'
import Item from './Item'
import Group from './Group'
import Empty from './Empty'
import { byTitle, groupByRecency } from './order'

export default function Manager() {
  const tags = useStore(state => state.filters.tags)
  const scope = useStore(state => state.filters.scope)
  const query = useStore(state => state.filters.query)
  const items = useStore(state => state.entries.items)
  const sort = useStore(state => state.sort)

  const entries = filterEntries(items, { scope, query, tags })

  if (entries.length === 0) return <Empty />

  // A–Z is a flat index — grouping it by date would fight the ordering.
  if (sort === 'alpha')
    return (
      <div className="pb-6">
        {byTitle(entries).map(entry => (
          <Item entry={entry} key={entry.id} />
        ))}
      </div>
    )

  return (
    <div className="pb-6">
      {groupByRecency(entries).map(group => (
        <Group title={group.title} entries={group.entries} key={group.title} />
      ))}
    </div>
  )
}
