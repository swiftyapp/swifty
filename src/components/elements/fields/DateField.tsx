import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { getFormat } from '@/defaults/dateFormat'
import { cx } from '@/utils/cx'
import { daysUntil, formatDate, relativeFuture, toIsoDate } from '@/utils/time'
import { useField } from './context'
import Field from './Field'

// A calendar date. Stored as ISO `YYYY-MM-DD` and read in the pattern picked in
// Settings › Language & region — in the editor too, so a date is typed in the
// same form it is read back in, and the placeholder says which form that is.
export default function DateField({
  name,
  label,
  required,
  expiry
}: {
  name: string
  label: TKey
  required?: boolean
  /** A date the document lives by: reading it also says how long it has left. */
  expiry?: boolean
}) {
  const { t } = useTranslation()
  const { value, editing } = useField(name)

  // A sentence about the date, not a second copy of it — and only where there
  // is nothing to type: mid-edit the date is half a date most of the time.
  const days = expiry && !editing ? daysUntil(value) : null
  const stamp =
    days === null ? undefined : (
      <span className={cx('font-mono text-xs', days < 0 ? 'text-bad' : 'text-text3')}>
        {days < 0 ? t('Expired') : t('Expires {{when}}', { when: relativeFuture(value) })}
      </span>
    )

  return (
    <Field
      name={name}
      label={label}
      required={required}
      maxLength={10}
      // The pattern itself, not catalog copy — a date format has no translation.
      placeholder={getFormat()}
      format={formatDate}
      normalize={toIsoDate}
      below={stamp}
    />
  )
}
