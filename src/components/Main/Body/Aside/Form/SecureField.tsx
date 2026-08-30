import { useState, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import type { EntryDraft } from '@/defaults/entries'
import { valueOf, type FieldChange } from './helpers'
import View from '@/assets/images/view.svg?react'
import Hide from '@/assets/images/hide.svg?react'

interface Props {
  label: string
  name: string
  entry: EntryDraft
  validate?: boolean
  onChange: (event: FieldChange) => void
  rows?: number
  maxLength?: number
  children?: ReactNode
}

export default function SecureField({
  label,
  name,
  entry,
  validate,
  onChange,
  rows,
  maxLength,
  children
}: Props) {
  const [show, setShow] = useState(false)
  const value = valueOf(entry, name)
  const error = validate && value.trim() === ''

  return (
    <div
      className={cx('field', {
        'secure-on': !show,
        'secure-off': show,
        error
      })}
    >
      <label>{label}</label>
      <div className="value">
        <div className="wrapper">
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
          <View width="16" height="16" onClick={() => setShow(!show)} className="view" />
          <Hide width="16" height="16" onClick={() => setShow(!show)} className="hide" />
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
