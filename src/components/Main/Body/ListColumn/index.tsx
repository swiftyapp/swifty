import type { ReactNode } from 'react'
import { useStore } from '@/store'
import type { View } from '@/store/uiSlice'
import { kindOf } from '@/kinds'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { useLayout } from '@/hooks/useLayout'
import { cx } from '@/utils/cx'
import KindChips from './KindChips'
import ActiveTag from './ActiveTag'
import List from '../List'
import SortMenu from '../List/SortMenu'
import Search from './Search'
import { DetailEmpty } from '../Empty'
import { useVariant, isWholeView } from '../Empty/variant'
import { useListKeys } from './useListKeys'

// The middle pane: a title with the sort control, the search field and the kind
// filter chips, over the scrollable entry list.
// The column is titled after the view, except in All Items, where a kind chip
// renames it to what it is now showing ("Logins"). The other views keep their
// own name: "Logins" would lose the fact that you are looking at the Archive.
const TITLES: Record<View, TKey> = {
  items: 'All Items',
  favorites: 'Favorites',
  health: 'Vault Health',
  archive: 'Archive'
}

interface Props {
  /**
   * Extra controls for the title row. The compact shell has no rail to put the
   * tag filter and the add button on, so it hands them down here instead.
   */
  actions?: ReactNode
}

export default function ListColumn({ actions }: Props) {
  const { t } = useTranslation()
  const view = useStore(state => state.ui.view)
  const type = useStore(state => state.filters.type)
  const health = view === 'health'
  const onKeyDown = useListKeys()
  const compact = useLayout() === 'compact'
  // Compact is the only pane on screen, so it also has to carry the hero the
  // detail pane shows on wide — otherwise an empty vault is a blank screen.
  const variant = useVariant()

  const title = view === 'items' && type ? t(kindOf(type).pluralLabel) : t(TITLES[view])

  return (
    <div
      // One keydown for the whole column, so ↑/↓ reach the list from the search
      // field as well as from a row. The audit list has no roving selection to
      // walk, so it is left off there.
      onKeyDown={health ? undefined : onKeyDown}
      className={cx(
        'flex min-h-0 flex-col bg-list',
        compact ? 'w-full flex-1' : 'w-[348px] flex-none border-r border-line'
      )}
    >
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
          {!health && <SortMenu compact={compact} />}
          {!health && actions}
        </div>
        {/* The audit is not a filtered view of the vault, so neither the query
            nor the chips apply to it. */}
        {!health && (
          <>
            <Search />
            <KindChips />
            <ActiveTag />
          </>
        )}
      </div>
      {/* The scroller is the listbox itself: rows report their selection to it
          (List/Item), and it is what a selected row scrolls itself into. */}
      <div
        role="listbox"
        aria-label={title}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <List />
        {compact && variant && isWholeView(variant) && <DetailEmpty variant={variant} />}
      </div>
    </div>
  )
}
