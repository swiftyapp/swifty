import { useTranslation } from 'react-i18next'
import type { EntryMeta } from '@/api/types'
import { kindOf } from '@/kinds'
import { setNoEntry } from '@/store'
import EmptyState from '@/components/elements/EmptyState'

interface Props {
  entry: EntryMeta
  onRetry: () => void
}

/**
 * What the entry surface shows when the reveal was refused: a message, a way
 * to ask again, and a way out. Both shells draw this in place of the rows,
 * where a silent failure used to leave a pane that looked like one still
 * loading.
 */
export default function RevealError({ entry, onRetry }: Props) {
  const { t } = useTranslation()
  const { Glyph } = kindOf(entry.type)

  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <EmptyState
        testid="reveal-error"
        mark={<Glyph size={28} />}
        markClassName="bg-bad/10 text-bad"
        title={entry.title}
        body={t('Could not open this entry. Please try again.')}
        primary={{ label: t('Try again'), onClick: onRetry, testid: 'reveal-retry-button' }}
        secondary={{ label: t('Close'), onClick: setNoEntry, testid: 'reveal-close-button' }}
      />
    </div>
  )
}
