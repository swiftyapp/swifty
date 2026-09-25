import type { EntryMeta } from '@/api/types'
import { useUi } from '@/store'
import Item from './Item'
import GroupHeader from './GroupHeader'
import ListEmpty from '../Empty'
import { useVisibleEntries, useGrouped } from './useVisibleEntries'

// One kind's run of rows in a grouped list. The rows arrive already sectioned
// (`useVisibleEntries`), so a section is just where the kind changes.
const sections = (entries: EntryMeta[]): EntryMeta[][] => {
  const runs: EntryMeta[][] = []
  for (const entry of entries) {
    const run = runs[runs.length - 1]
    if (run && run[0].type === entry.type) run.push(entry)
    else runs.push([entry])
  }
  return runs
}

// A mixed list is its rows under a sticky caption per kind, in registry order;
// a kind's own list and a search are flat. Date buckets earn nothing either
// way — retrieval here is by name or search (the audit list keeps its severity
// groups, which do).
export default function Manager() {
  const entries = useVisibleEntries()
  const grouped = useGrouped()
  const door = useUi(state => state.view === 'items')

  // What "nothing here" means (first run, a filter, a query) is decided in one
  // place for both panes — see Body/Empty.
  if (entries.length === 0) return <ListEmpty />

  // One kind in the whole list is one section, and a caption over the only
  // section would only repeat what every row's tile already says.
  const runs = grouped ? sections(entries) : []
  if (runs.length < 2)
    return (
      <div className="pb-6">
        {entries.map(entry => (
          <Item entry={entry} key={entry.id} />
        ))}
      </div>
    )

  return (
    <div className="pb-6">
      {runs.map(run => {
        const type = run[0].type
        const id = `group-${type}-label`
        return (
          // A listbox may hold groups of options, and the caption is the
          // group's name — so a reader hears "Credit cards" on entering it.
          <div role="group" aria-labelledby={id} key={type}>
            <GroupHeader type={type} count={run.length} id={id} door={door} />
            {run.map(entry => (
              <Item entry={entry} key={entry.id} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
