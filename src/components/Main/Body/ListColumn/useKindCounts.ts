import { useMemo } from 'react'
import type { EntryType } from '@/api/types'
import { useVault } from '@/store'

// How many live items the vault holds of each kind.
//
// Counted off the whole vault rather than the open view, like the tag counts:
// picking a kind opens All Items on that kind, so its count says how many that
// will be whichever view the menu was opened from. A kind with no items is
// absent from the map.
export const useKindCounts = (): Map<EntryType, number> => {
  const items = useVault(state => state.items)

  return useMemo(() => {
    const totals = new Map<EntryType, number>()
    for (const item of items) totals.set(item.type, (totals.get(item.type) ?? 0) + 1)
    return totals
  }, [items])
}
