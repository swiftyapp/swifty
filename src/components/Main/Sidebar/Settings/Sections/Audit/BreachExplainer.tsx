import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { META } from '@/components/elements/tokens'

// An illustrative SHA-1 (of "password"), not one of the user's: the explainer
// shows the shape of what is sent, never a real hash.
const HASH = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'
const SENT = 5

function Legend({ swatch, children }: { swatch: string; children: string }) {
  return (
    <span className={cx(META, 'flex items-center gap-1.5')}>
      <span className={cx('h-2 w-2 flex-none rounded-xs', swatch)} />
      {children}
    </span>
  )
}

// k-anonymity, drawn: the five characters that go out, lit, and the rest that
// stays here.
export default function BreachExplainer({ id }: { id: string }) {
  const { t } = useTranslation()

  return (
    <div
      id={id}
      data-testid="settings-breach-explainer"
      className="animate-pop rounded-lg border border-line bg-field p-3.5"
    >
      <div className="break-all text-base tabular-nums">
        <span className="rounded-xs bg-accent-soft px-1 text-accent">{HASH.slice(0, SENT)}</span>
        <span className="text-text2">{HASH.slice(SENT)}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        <Legend swatch="bg-accent">{t('sent · first 5 of SHA-1')}</Legend>
        <Legend swatch="bg-line2">{t('never leaves this device')}</Legend>
      </div>
      <p className="mt-2.5 text-sm text-text2">
        {t(
          'Only the first 5 characters of each password’s SHA-1 hash are sent (k-anonymity). Your password and its full hash never leave this device.'
        )}
      </p>
    </div>
  )
}
