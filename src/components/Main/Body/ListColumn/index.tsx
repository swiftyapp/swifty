import { useStore } from '@/store'
import type { View } from '@/store/uiSlice'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import KindChips from '../../Header/KindChips'
import List from '../List'
import SortMenu from '../List/SortMenu'
import Search from './Search'
import { useListKeys } from './useListKeys'

// The middle pane: a title with the sort control, the search field and the kind
// filter chips, over the scrollable entry list.
// The column is titled after the view, except in All Items, where a kind chip
// renames it to what it is now showing ("Logins"). The other views keep their
// own name: "Logins" would lose the fact that you are looking at the Trash.
const TITLES: Record<View, string> = {
  items: 'All Items',
  favorites: 'Favorites',
  health: 'Vault Health',
  trash: 'Trash'
}

export default function ListColumn() {
  const view = useStore(state => state.ui.view)
  const type = useStore(state => state.filters.type)
  const health = view === 'health'
  const onKeyDown = useListKeys()

  const title = view === 'items' && type ? t(kindOf(type).pluralLabel) : t(TITLES[view])

  return (
    <div
      // One keydown for the whole column, so ↑/↓ reach the list from the search
      // field as well as from a row. The audit list has no roving selection to
      // walk, so it is left off there.
      onKeyDown={health ? undefined : onKeyDown}
      className="flex w-[348px] min-h-0 flex-none flex-col border-r border-line bg-list"
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
          {!health && <SortMenu />}
        </div>
        {/* The audit is not a filtered view of the vault, so neither the query
            nor the chips apply to it. */}
        {!health && (
          <>
            <Search />
            <KindChips />
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
      </div>
    </div>
  )
}
