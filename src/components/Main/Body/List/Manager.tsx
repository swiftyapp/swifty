import type { EntryMeta } from '@/api/types'
import { useUi } from '@/store'
import Item from './Item'
import Section from './Section'
import ListEmpty from '../Empty'
import { useVisibleEntries, useGrouped } from './useVisibleEntries'

const sections = (entries: EntryMeta[]): EntryMeta[][] => {
  const runs: EntryMeta[][] = []
  for (const entry of entries) {
    const run = runs[runs.length - 1]
    if (run && run[0].type === entry.type) run.push(entry)
    else runs.push([entry])
  }
  return runs
}

export default function Manager() {
  const entries = useVisibleEntries()
  const grouped = useGrouped()
  const door = useUi(state => state.view === 'items')

  if (entries.length === 0) return <ListEmpty />

  const runs = grouped ? sections(entries) : []
  const captioned = runs.length > 1

  return (
    <div className="pb-6">
      {captioned
        ? runs.map(run => (
            <Section key={run[0].type} type={run[0].type} count={run.length} door={door}>
              {run.map(entry => (
                <Item entry={entry} key={entry.id} />
              ))}
            </Section>
          ))
        : entries.map(entry => <Item entry={entry} key={entry.id} />)}
    </div>
  )
}
