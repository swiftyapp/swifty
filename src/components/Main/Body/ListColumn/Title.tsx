import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUi } from '@/store'
import { cx } from '@/utils/cx'
import { ChevronDownGlyph } from '../../icons'
import { useListTitle } from './useListTitle'
import ScopeMenu from './ScopeMenu'

export default function Title({ className = 'text-xl' }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const title = useListTitle()
  const scoped = useUi(state => state.view === 'items')

  const words = cx('min-w-0 truncate font-semibold tracking-display text-text', className)

  if (!scoped)
    return (
      <div data-testid="list-title" className={cx('flex-1', words)}>
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
        <span className={words}>{title}</span>
        <span
          className={cx('flex-none text-text2 transition-transform', open && 'rotate-180')}
        >
          <ChevronDownGlyph stroke={2} />
        </span>
      </button>
      {open && <ScopeMenu onClose={() => setOpen(false)} />}
    </div>
  )
}
