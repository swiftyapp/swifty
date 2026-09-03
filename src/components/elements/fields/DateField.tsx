import type { TKey } from '@/i18n'
import { getFormat } from '@/defaults/dateFormat'
import { formatDate, toIsoDate } from '@/utils/time'
import Field from './Field'

// A calendar date. Stored as ISO `YYYY-MM-DD` and read in the pattern picked in
// Settings › Language & region — in the editor too, so a date is typed in the
// same form it is read back in, and the placeholder says which form that is.
export default function DateField({
  name,
  label,
  required
}: {
  name: string
  label: TKey
  required?: boolean
}) {
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
    />
  )
}
