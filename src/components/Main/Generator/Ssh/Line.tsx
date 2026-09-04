import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import { MONO_LABEL } from '@/components/elements/tokens'
import type { TKey } from '@/i18n'

interface Props {
  label: TKey
  value: string
  testid: string
}

// One non-secret line of the generated key — the public key, the fingerprint —
// on the dialog's field tile, with the copy button that is the point of it.
export default function Line({ label, value, testid }: Props) {
  const { t } = useTranslation()
  return (
    <div>
      <div className={MONO_LABEL}>{t(label)}</div>
      <div className="mt-1 flex items-start gap-1.5">
        <div
          data-testid={testid}
          className="min-w-0 flex-1 rounded-lg border border-line2 bg-field px-3 py-2 font-mono text-base leading-[1.55] break-all"
        >
          {value}
        </div>
        <CopyButton value={value} title={t('Copy')} />
      </div>
    </div>
  )
}
