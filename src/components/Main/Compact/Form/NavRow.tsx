import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import type { Draft } from '../../Body/Aside/Show/Edit/useDraft'

interface Props {
  draft: Draft
  /** What this screen is for: "Add a login", or the entry being edited. */
  title: string
}

/**
 * The form screen's nav row: Cancel on the left, Save on the right, the iOS way
 * round.
 *
 * Cancel is the draft's own guarded exit rather than a second way out — the
 * first press arms it and says so, the second discards. That wording is also
 * why the desktop's unsaved dot is not here: a Cancel that reads "Discard
 * changes?" already tells you there is something to lose.
 */
export default function NavRow({ draft, title }: Props) {
  const { t } = useTranslation()

  return (
    <header className="flex flex-none items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
      {/* Same element for both presses: arm, then discard. */}
      <button
        type="button"
        data-testid="cancel-entry-button"
        onClick={draft.cancel}
        className={cx(
          'flex h-14 min-w-11 cursor-pointer items-center px-2 text-md',
          draft.confirmDiscard ? 'text-bad' : 'text-accent'
        )}
      >
        {draft.confirmDiscard ? t('Discard changes?') : t('Cancel')}
      </button>

      <h1 className="min-w-0 flex-1 truncate text-center text-md font-semibold tracking-display text-text">
        {title}
      </h1>

      <button
        type="button"
        data-testid="save-entry-button"
        onClick={draft.save}
        className="flex h-14 min-w-11 cursor-pointer items-center justify-end px-2 text-md font-semibold text-accent"
      >
        {t('Save')}
      </button>
    </header>
  )
}
