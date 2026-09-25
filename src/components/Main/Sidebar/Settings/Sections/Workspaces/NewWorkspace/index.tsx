import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { ChevronRightGlyph, PlusGlyph } from '@/components/Main/icons'
import Form from './Form'

// The list's last row: the way to one more workspace. It unfolds the form in
// place rather than pushing a screen — it is two fields and a button. The
// card it closes leaves its overflow open (for the rows' menus), so the row
// rounds its own bottom corners to match while it is the card's edge.
export default function NewWorkspace() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const formId = useId()

  return (
    <div>
      <button
        type="button"
        data-testid="workspace-new-row"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen(value => !value)}
        className={cx(
          'flex w-full cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-hover',
          !open && 'rounded-b-lg max-md:rounded-b-xl'
        )}
      >
        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border-[1.5px] border-dashed border-accent-line text-accent">
          <PlusGlyph />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-accent">{t('New workspace')}</span>
          <span className="mt-0.5 block text-sm text-text2">
            {t('A separate encrypted vault for work, family or a client')}
          </span>
        </span>
        <ChevronRightGlyph
          className={cx('flex-none text-text2 transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div id={formId} className="animate-pop pr-4 pb-4 pl-[66px]">
          <Form />
        </div>
      )}
    </div>
  )
}
