import { useMemo } from 'react'
import { useRows } from '../../Body/List/useVisibleEntries'

export interface TagCount {
  tag: string
  count: number
}

// The tags of the current view's rows, with how many rows carry each.
//
// Counted off `useRows` — the view before any filter — for two reasons: the
// counts stay truthful inside Favorites and the Trash, and picking a tag never
// shrinks the menu that offered it (counting the filtered list would leave the
// chosen tag as the only row left).
export const useTagCounts = (): TagCount[] => {
  const rows = useRows()

  return useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of rows)
      for (const tag of row.tags) totals.set(tag, (totals.get(tag) ?? 0) + 1)

    // Busiest first, ties alphabetical, so the menu has a stable order.
    return [...totals]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [rows])
}
