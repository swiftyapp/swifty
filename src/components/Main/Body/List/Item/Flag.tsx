import { cx } from '@/utils/cx'
import { useTranslation } from 'react-i18next'
import type { FlagKind } from './audit'

// An audit verdict as a row badge: a bordered pill in `currentColor`, so one
// ink token sets both the label and the outline.
export default function Flag({ kind }: { kind: FlagKind }) {
  const { t } = useTranslation()
  return (
    <span
      className={cx(
        'flex-none rounded-sm border border-current px-1.5 font-mono text-xs opacity-85',
        kind === 'weak' ? 'text-bad' : 'text-warn'
      )}
    >
      {t(kind)}
    </span>
  )
}
