import { cx } from '@/utils/cx'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import type { Draft } from './useDraft'

// The editing header's cluster, where the read view's Edit / menu / copy
// buttons sit: an unsaved dot, the guarded Cancel, and Save.
export default function Actions({ draft }: { draft: Draft }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-none items-center gap-1.5">
      {draft.dirty && (
        <span
          title={t('Unsaved changes')}
          className="mr-1 h-1.5 w-1.5 flex-none rounded-full bg-accent"
        />
      )}
      {/* Same element for both presses: arm, then discard. */}
      <button
        type="button"
        data-testid="cancel-entry-button"
        onClick={draft.cancel}
        className={cx(
          'h-7 cursor-pointer rounded-sm px-3 text-base transition-colors',
          draft.confirmDiscard ? 'text-bad hover:brightness-110' : 'text-text2 hover:text-text'
        )}
      >
        {draft.confirmDiscard ? t('Discard changes?') : t('Cancel')}
      </button>
      <Button size="md" kbd="⌘⏎" testid="save-entry-button" onClick={draft.save}>
        {t('Save')}
      </Button>
    </div>
  )
}
