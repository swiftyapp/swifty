import { useTranslation } from 'react-i18next'
import CopyButton from '@/components/elements/CopyButton'
import { FieldRow, useField } from '@/components/elements/fields'
import { VALUE } from '@/components/elements/tokens'

// Derived, never typed: the generator stamps it with the key, so the row reads
// the same in both modes and a key pasted in by hand simply has none to show.
export default function Fingerprint() {
  const { t } = useTranslation()
  const { value } = useField('fingerprint')

  if (value === '') return null

  return (
    <FieldRow label="Fingerprint" actions={<CopyButton value={value} title={t('Copy')} />}>
      {() => (
        <span
          className={`${VALUE} text-text`}
          data-testid="entry-value-fingerprint"
        >
          {value}
        </span>
      )}
    </FieldRow>
  )
}
