import type { ReactNode } from 'react'
import { useStore } from '@/store'
import type { View } from '@/store/uiSlice'
import { kindOf } from '@/kinds'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import KindChips from './KindChips'
import ActiveTag from './ActiveTag'
import List from '../List'
import Search from './Search'
import { useListKeys } from './useListKeys'

// The middle pane: a title with the caller's controls, the search field and the
// kind filter chips, over the scrollable entry list.
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
   * The title row's controls, hidden with the rest of the filtering chrome on
   * the audit view. The wide shell sends the sort menu; the compact one, with no
   * rail to keep them on, adds the tag filter and the add button.
   */
  actions?: ReactNode
  /**
   * Rendered inside the listbox under the rows. The compact shell has no second
   * pane, so it puts the empty-vault hero here.
   */
  footer?: ReactNode
}

export default function ListColumn({ actions, footer }: Props) {
  const { t } = useTranslation()
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
      // The column fills whatever its caller gives it: 348px of the wide shell,
      // the whole phone screen on compact.
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-list"
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
          {/* The audit list has its own severity order — nothing to sort, and
              nothing the chips or the query below would narrow either. */}
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
        {footer}
      </div>
    </div>
  )
}
