import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { cx } from '@/utils/cx'
import KindChips from './KindChips'
import ActiveTag from './ActiveTag'
import List from '../List'
import Search from './Search'
import { useListKeys } from './useListKeys'
import { useListTitle } from './useListTitle'

// The middle pane: a title with the caller's controls, the search field and the
// kind filter chips, over the scrollable entry list.
interface Props {
  /**
   * The title row's controls, hidden with the rest of the filtering chrome on
   * the audit view. The wide shell sends the sort menu; the compact one, with no
   * rail to keep them on, adds the tag filter and the add button.
   */
  actions?: ReactNode
  /**
   * Replaces the 20px title block. The compact root sends its large title —
   * same words (`useListTitle`), a micro eyebrow above them.
   */
  heading?: ReactNode
  /**
   * The title row's own classes — alignment and height, not side padding, which
   * the box around the row, the search and the chips gives all three. Absent,
   * the desktop's: 16px under the top of the column, the controls sat on the
   * title's baseline. The compact root sends its 56px nav-height row
   * (`ROOT_HEADER`).
   */
  header?: string
  /**
   * The search box's own classes. Absent, it keeps the 28px desktop field; the
   * compact root sends the 44px touch one.
   */
  search?: string
  /** Extra classes for the scroller, so a shell can reserve room under it. */
  scroller?: string
  /**
   * Rendered in the scroller under the listbox — outside it, so a hero and its
   * buttons are never announced as options. The compact shell has no second
   * pane, so it puts there what the wide one puts in its detail pane.
   */
  footer?: ReactNode
}

export default function ListColumn({
  actions,
  heading,
  header = 'flex items-end gap-2.5 pt-4',
  search,
  scroller,
  footer
}: Props) {
  const view = useStore(state => state.ui.view)
  const health = view === 'health'
  const onKeyDown = useListKeys()
  const title = useListTitle()

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
      <div className="flex-none px-4 pb-2.5">
        <div className={header}>
          {heading ?? (
            <div className="min-w-0 flex-1">
              <div
                data-testid="list-title"
                className="text-xl font-semibold tracking-display text-text"
              >
                {title}
              </div>
            </div>
          )}
          {/* The audit list has its own severity order — nothing to sort, and
              nothing the chips or the query below would narrow either. */}
          {!health && actions}
        </div>
        {/* The audit is not a filtered view of the vault, so neither the query
            nor the chips apply to it. */}
        {!health && (
          <>
            <Search className={search} />
            <KindChips />
            <ActiveTag />
          </>
        )}
      </div>
      {/* The scroller is what a selected row scrolls itself into (List/Item's
          `scrollIntoView`), but it is not the listbox: the footer under the rows
          is a hero with its own buttons, and inside `role="listbox"` those are
          neither options nor reachable as controls. */}
      <div className={cx('min-h-0 flex-1 overflow-y-auto', scroller)}>
        <div role="listbox" aria-label={title}>
          <List />
        </div>
        {footer}
      </div>
    </div>
  )
}
