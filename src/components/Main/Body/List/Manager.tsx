import Item from './Item'
import ListEmpty from '../Empty'
import { useVisibleEntries } from './useVisibleEntries'

// A flat list in either order — retrieval here is by name or search, so date
// buckets earn nothing (the audit list keeps its severity groups, which do).
export default function Manager() {
  const entries = useVisibleEntries()

  // What "nothing here" means (first run, a filter, a query) is decided in one
  // place for both panes — see Body/Empty.
  if (entries.length === 0) return <ListEmpty />

  return (
    <div className="pb-6">
      {entries.map(entry => (
        <Item entry={entry} key={entry.id} />
      ))}
    </div>
  )
}
