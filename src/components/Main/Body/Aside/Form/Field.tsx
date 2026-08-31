import { cx } from '@/utils/cx'
import type { EntryDraft } from '@/defaults/entries'
import { valueOf, type FieldChange } from './helpers'
import { inputClass, labelClass } from '@/components/elements/formStyles'

interface Props {
  label: string
  name: string
  entry: EntryDraft
  validate?: boolean
  onChange: (event: FieldChange) => void
  rows?: number
  maxLength?: number
}

export default function Field({
  label,
  name,
  entry,
  validate,
  onChange,
  rows,
  maxLength
}: Props) {
  const value = valueOf(entry, name)
  const error = validate && value.trim() === ''
  const control = cx(inputClass, error && '!border-bad')

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {rows ? (
        <textarea
          className={cx(control, 'resize-none')}
          name={name}
          rows={rows}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
        />
      ) : (
        <input
          className={control}
          name={name}
          type="text"
          value={value}
          onChange={onChange}
          maxLength={maxLength}
        />
      )}
    </div>
  )
}
