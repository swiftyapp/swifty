import { useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import { EyeGlyph, EyeOffGlyph } from '../../Main/icons'
import CopyButton from '../CopyButton'
import IconButton from '../IconButton'
import { useField } from './context'
import FieldRow from './Row'

export interface FieldProps {
  /** Draft key, and the input's `name` — the selector the e2e suite owns. */
  name: string
  /** Untranslated row label; omit for a full-bleed row. */
  label?: string
  /** Blocks the save while empty and marks the row after the first attempt. */
  required?: boolean
  /** Masked until the eye is pressed, in both modes. */
  secure?: boolean
  /** The row's headline secret: 2xl, letter-spaced for reading aloud. */
  big?: boolean
  /** Character-by-character tracking without the size bump. */
  secret?: boolean
  type?: string
  maxLength?: number
  placeholder?: string
  prefix?: ReactNode
  /** Trailing controls shown in both modes. */
  actions?: ReactNode
  below?: ReactNode
  /** Stored → displayed, live (card-number grouping). */
  format?: (value: string) => string
  /** Typed → stored, live (a card number keeps only digits). */
  parse?: (value: string) => string
  /** Stored → stored, on blur (a URL gains its missing scheme). */
  normalize?: (value: string) => string
  /** A format complaint about a non-empty value, or ''. */
  check?: (value: string) => string
}

const MASK = { WebkitTextSecurity: 'disc' } as CSSProperties

// One field, both modes. Reading, it is the detail row it has always been:
// mono value, reveal toggle, copy button, hidden when empty. Editing, the same
// row with the value swapped for an underlined borderless input. Every
// type-aware field in this folder is a thin wrapper around it.
export default function Field({
  name,
  label,
  required,
  secure,
  big,
  secret,
  type = 'text',
  maxLength,
  placeholder,
  prefix,
  actions,
  below,
  format,
  parse,
  normalize,
  check
}: FieldProps) {
  const { value, set, editing, attempted } = useField(name)
  const [show, setShow] = useState(false)

  // Reading, an empty field is not a field.
  if (!editing && value === '') return null

  const error = !value.trim()
    ? attempted && required
      ? t('Required')
      : ''
    : (check?.(value) ?? '')

  const masked = secure && !show
  const mask = masked ? MASK : undefined
  const ink = cx(
    'block h-6 w-full min-w-0 truncate font-mono leading-6 text-text',
    big ? 'text-xl tracking-secret' : secret ? 'text-base tracking-secret' : 'text-base'
  )

  return (
    <FieldRow
      label={label}
      prefix={prefix}
      below={below}
      error={error}
      actions={
        <>
          {actions}
          {secure && (
            <IconButton
              title={show ? t('Hide') : t('Reveal')}
              active={show}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOffGlyph /> : <EyeGlyph />}
            </IconButton>
          )}
          {!editing && <CopyButton value={value} title={t('Copy')} />}
        </>
      }
    >
      {editing ? (
        <input
          name={name}
          type={type}
          value={format ? format(value) : value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          style={mask}
          onChange={event => set(parse ? parse(event.target.value) : event.target.value)}
          onBlur={normalize ? () => set(normalize(value)) : undefined}
          className={cx(
            ink,
            'border-b bg-transparent outline-none transition-colors placeholder:text-text3',
            error ? 'border-bad' : 'border-line2 focus:border-accent-line'
          )}
        />
      ) : (
        <span className={ink} style={mask} data-testid={`entry-value-${name}`}>
          {format ? format(value) : value}
        </span>
      )}
    </FieldRow>
  )
}
