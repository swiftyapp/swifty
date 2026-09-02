import { useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import type { EntryDraft } from '@/defaults/entries'
import { valueOf, type FieldChange } from './helpers'
import {
  inputClass,
  labelClass,
  textareaClass
} from '@/components/elements/formStyles'
import IconButton from '@/components/elements/IconButton'
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
  const control = cx('!pr-10', error && '!border-bad')

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        {rows ? (
          <textarea
            className={cx(textareaClass, control, 'resize-none')}
            name={name}
            rows={rows}
            value={value}
            style={mask}
            onChange={onChange}
            maxLength={maxLength}
          />
        ) : (
          <input
            className={cx(inputClass, control)}
            name={name}
            type="text"
            value={value}
            style={mask}
            onChange={onChange}
            maxLength={maxLength}
          />
        )}
        <IconButton
          className="absolute top-1 right-1"
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
