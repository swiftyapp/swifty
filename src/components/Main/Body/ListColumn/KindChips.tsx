import { useMemo } from 'react'
import { useUi, setFilterType } from '@/store'
import { KINDS } from '@/kinds'
import { useTranslation } from 'react-i18next'
import { useRows } from '../List/useVisibleEntries'
import Chip from './Chip'

// The list-column kind filter: an "All" chip plus one per registered kind, each
// with a live count. This is what replaced the rail's type tabs — narrowing the
// list, not navigating away from it.
export default function KindChips() {
  const { t } = useTranslation()
  const type = useUi(state => state.filterType)
  // The current view's rows, not the whole vault, so the counts tell the truth
  // in Favorites and the Archive as well as in All Items. `useRows` hands back
  // stable references for exactly this memo.
  const items = useRows()
  const counts = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of items) totals.set(item.type, (totals.get(item.type) ?? 0) + 1)
    return totals
  }, [items])

  return (
    <div
      data-testid="kinds-list"
      // On the phone the strip bleeds through the column's 16px gutters, so
      // chips scroll out under the screen's edge rather than being cut at it.
      className="mt-3.5 flex gap-[5px] overflow-x-auto pb-0.5 max-md:-mx-4 max-md:gap-2 max-md:px-4"
    >
      <Chip
        testid="filter-all"
        label={t('All Items')}
        count={items.length}
        selected={type === null}
        onClick={() => setFilterType(null)}
      />
      {KINDS.map(kind => (
        <Chip
          key={kind.type}
          testid={`filter-${kind.type}`}
          label={t(kind.pluralLabel)}
          count={counts.get(kind.type) ?? 0}
          selected={type === kind.type}
          onClick={() => setFilterType(kind.type)}
        />
      ))}
    </div>
  )
}
