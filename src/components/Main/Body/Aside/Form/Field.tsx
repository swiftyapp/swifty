import { cx } from '@/utils/cx'
import type { EntryDraft } from '@/defaults/entries'
import { valueOf, type FieldChange } from './helpers'

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

  return (
    <div className={cx('field', { error })}>
      <label>{label}</label>
      {rows ? (
        <textarea
          name={name}
          cols={10}
          rows={rows}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
        />
      ) : (
        <input
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
