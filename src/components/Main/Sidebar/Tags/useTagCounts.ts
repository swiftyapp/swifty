import { useMemo } from 'react'
import { useStore } from '@/store'

export interface TagCount {
  tag: string
  count: number
}

// Every tag in the vault, with how many items carry each.
//
// Counted off the whole vault rather than the open view: picking a tag opens
// the Tags view on every item carrying it, so a count says how many that will
// be whichever view the menu was opened from.
export const useTagCounts = (): TagCount[] => {
  const items = useStore(state => state.entries.items)

  return useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of items)
      for (const tag of item.tags) totals.set(tag, (totals.get(tag) ?? 0) + 1)

    // Busiest first, ties alphabetical, so the menu has a stable order.
    return [...totals]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [items])
}
