import { useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import type { EntryDraft } from '@/defaults/entries'
import { valueOf, type FieldChange } from './helpers'
import { inputClass, labelClass } from '@/components/elements/formStyles'
import { IconButton } from '../ui'
import { EyeGlyph, EyeOffGlyph } from '../../../icons'

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
  const mask: CSSProperties = {
    WebkitTextSecurity: show ? 'none' : 'disc'
  } as CSSProperties
  const control = cx(inputClass, '!pr-10', error && '!border-bad')

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        {rows ? (
          <textarea
            className={cx(control, 'resize-none')}
            name={name}
            rows={rows}
            value={value}
            style={mask}
            onChange={onChange}
            maxLength={maxLength}
          />
        ) : (
          <input
            className={control}
            name={name}
            type="text"
            value={value}
            style={mask}
            onChange={onChange}
            maxLength={maxLength}
          />
        )}
        <IconButton
          className="absolute right-1.5 top-1.5"
          active={show}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOffGlyph /> : <EyeGlyph />}
        </IconButton>
      </div>
      {children && <div className="mt-2 flex justify-end">{children}</div>}
    </div>
  )
}
