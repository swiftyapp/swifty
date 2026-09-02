import { useMemo } from 'react'
import { useStore, setFilterTag, unsetFilterTag } from '@/store'
import Chip from './Chip'

// The list-column tag filter: a horizontal, scrollable row of chips, one per
// tag used by the entries the kind filter currently admits, each with a live
// count. Selecting a chip filters the list to that tag; selecting it again
// clears the filter.
export default function Tags() {
  const selected = useStore(state => state.filters.tags[0])
  // Select stable store references and derive the tag list in a memo — a
  // selector that returns a freshly built array re-runs useSyncExternalStore
  // forever (its snapshot is never referentially equal, even under useShallow,
  // because the [tag, count] tuples are new references each pass).
  const items = useStore(state => state.entries.items)
  const type = useStore(state => state.filters.type)
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      // No kind filter means every kind's tags are on offer.
      if (type && item.type !== type) continue
      for (const tag of item.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items, type])

  if (tags.length === 0) return null

  return (
    <div
      data-testid="tags-list"
      className="mt-3.5 flex gap-[5px] overflow-x-auto pb-0.5"
    >
      {tags.map(([tag, count]) => (
        <Chip
          key={tag}
          label={tag}
          count={count}
          selected={selected === tag}
          onClick={() => (selected === tag ? unsetFilterTag() : setFilterTag(tag))}
        />
      ))}
    </div>
  )
}
