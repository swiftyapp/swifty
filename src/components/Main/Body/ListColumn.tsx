import { useStore } from '@/store'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import KindChips from '../Header/KindChips'
import List from './List'
import SortMenu from './List/SortMenu'

// The middle pane: a title with the sort control and the kind filter chips,
// over the scrollable entry list.
export default function ListColumn() {
  const view = useStore(state => state.ui.view)
  const type = useStore(state => state.filters.type)
  const health = view === 'health'

  const title = health
    ? t('Vault Health')
    : type
      ? t(kindOf(type).pluralLabel)
      : t('All Items')

  return (
    <div className="flex w-[348px] min-h-0 flex-none flex-col border-r border-line bg-list">
      <div className="flex-none px-4 pt-4 pb-2.5">
        <div className="flex items-end gap-2.5">
          <div className="min-w-0 flex-1">
            <div
              data-testid="list-title"
              className="text-xl font-semibold tracking-display text-text"
            >
              {title}
            </div>
          </div>
          {/* The audit list has its own severity order — nothing to sort. */}
          {!health && <SortMenu />}
        </div>
        {/* The audit is not a filtered view of the vault, so the chips don't
            apply to it. */}
        {!health && <KindChips />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <List />
      </div>
    </div>
  )
}
