import { useMemo } from 'react'
import { useRows } from '../useVisibleEntries'

export interface TagCount {
  tag: string
  count: number
}

// Every tag in the vault, with how many items carry each.
//
// Counted off `useRows` — the Tags view's rows are the whole vault — rather than
// the filtered list: a tag gathers items from across the vault, so its count
// says how many it will show, whatever kind chip or query is on.
export const useTagCounts = (): TagCount[] => {
  const rows = useRows()

  return useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of rows)
      for (const tag of row.tags) totals.set(tag, (totals.get(tag) ?? 0) + 1)

    // Busiest first, ties alphabetical, so the list has a stable order.
    return [...totals]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [rows])
}
