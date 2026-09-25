import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUi } from '@/store'
import { cx } from '@/utils/cx'
import { ChevronDownGlyph } from '../../icons'
import { useListTitle } from './useListTitle'
import ScopeMenu from './ScopeMenu'

interface Props {
  /**
   * The title's type: the wide shell's 20px column title by default; the
   * compact root sends its 24px one.
   */
  className?: string
  /** Where the scope menu hangs, when the default under the title is wrong. */
  menu?: string
}

// The list column's title — and, in All Items, the switch between the places
// under it. The title already renames itself to the open kind ("Credit
// cards"), so the title is the one control that can pick the kind without
// adding any chrome: a chevron says it opens, and the menu it opens is the
// list of places with their counts. In every other view the title is text.
//
// The trigger is the prototype's pill around the words — 10px in front of
// them, 8px after the chevron, washed on hover and held on the selection wash
// while its menu is open, the chevron turned over — but it takes no room of
// its own: the 4px it adds above and below the line is given back in negative
// margin, so the words sit exactly where "Favorites" and "Archive" sit in
// their views and the header row keeps the same height in every view.
export default function Title({ className = 'text-xl', menu }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const title = useListTitle()
  const scoped = useUi(state => state.view === 'items')

  const type = cx('min-w-0 truncate font-semibold tracking-display text-text', className)

  if (!scoped)
    return (
      <div data-testid="list-title" className={cx('flex-1', type)}>
        {title}
      </div>
    )

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        data-testid="list-title"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('Choose what to show')}
        onClick={() => setOpen(value => !value)}
        className={cx(
          '-mx-2.5 -my-1 flex max-w-full cursor-pointer items-center gap-2 rounded-sm py-1 pl-2.5 pr-2 transition-colors',
          open ? 'bg-sel' : 'hover:bg-hover'
        )}
      >
        <span className={type}>{title}</span>
        <span
          className={cx('flex-none text-text2 transition-transform', open && 'rotate-180')}
        >
          <ChevronDownGlyph stroke={2} />
        </span>
      </button>
      {open && <ScopeMenu onClose={() => setOpen(false)} className={menu} />}
    </div>
  )
}
