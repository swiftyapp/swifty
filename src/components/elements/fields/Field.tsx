import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import type { TKey } from '@/i18n'
import { EyeGlyph, EyeOffGlyph } from '../../Main/icons'
import CopyButton from '../CopyButton'
import IconButton from '../IconButton'
import { useField } from './context'
import { requiredError } from './formats'
import FieldRow from './Row'

export interface FieldProps {
  /** Draft key, and the input's `name` — the selector the e2e suite owns. */
  name: string
  /** Untranslated row label; omit for a full-bleed row. */
  label?: TKey
  /** Blocks the save while empty and marks the row after the first attempt. */
  required?: boolean
  /** Masked until the eye is pressed, in both modes. */
  secure?: boolean
  /** The row's headline secret: 2xl, letter-spaced for reading aloud. */
  big?: boolean
  type?: string
  maxLength?: number
  placeholder?: string
  prefix?: ReactNode
  /** Trailing controls shown in both modes. */
  actions?: ReactNode
  below?: ReactNode
  /** Stored → stored, on blur (a URL gains its missing scheme). */
  normalize?: (value: string) => string
  /**
   * Stored → shown, in both modes — an ISO date read in the user's pattern.
   * Paired with `normalize`, which takes what was typed back to storage, so the
   * editor shows and accepts the same form the read view does.
   */
  format?: (value: string) => string
  /** A format complaint about a non-empty value, or ''. */
  check?: (value: string) => string
}

// An input cannot fake dots, so the editor hides its own text; a read value is
// plain text and gets a fixed-length mask instead — one that says nothing about
// how long the secret is.
const MASK = { WebkitTextSecurity: 'disc' } as CSSProperties
const DOTS = '•'.repeat(12)

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
  type = 'text',
  maxLength,
  placeholder,
  prefix,
  actions,
  below,
  normalize,
  format,
  check
}: FieldProps) {
  const { t } = useTranslation()
  const { value, set, editing, attempted } = useField(name)
  // Typing into dots is guesswork, so the editor starts revealed; the eye still
  // takes it back.
  const [show, setShow] = useState(editing)
  // What the row puts on screen and on the clipboard; the draft keeps `value`.
  const shown = format ? format(value) : value

  // Reading, an empty field is not a field.
  if (!editing && value === '') return null

  // Reading is error-free by construction: `attempted` is only ever true in an
  // editing session, and a format complaint is an editor's business.
  const error =
    editing && value.trim()
      ? (check?.(value) ?? '')
      : requiredError(value, required, attempted)

  const masked = secure && !show
  const mask = masked ? MASK : undefined
  // The headline treatment is for a secret being read, not for its mask.
  const ink = cx(
    'block h-6 w-full min-w-0 truncate font-mono leading-6',
    big && !masked ? 'text-xl tracking-secret' : 'text-base'
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
              testid={`reveal-${name}`}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOffGlyph /> : <EyeGlyph />}
            </IconButton>
          )}
          {!editing && <CopyButton value={shown} title={t('Copy')} />}
        </>
      }
    >
      {id =>
        editing ? (
        <input
          id={id}
          name={name}
          type={type}
          value={shown}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          style={mask}
          onChange={event => set(event.target.value)}
          onBlur={normalize ? () => set(normalize(value)) : undefined}
          className={cx(
            ink,
            'border-b bg-transparent text-text outline-none transition-colors placeholder:text-text3',
            error ? 'border-bad' : 'border-line2 focus:border-accent-line'
          )}
        />
        ) : (
          <span
            className={cx(ink, masked ? 'text-text2' : 'text-text')}
            data-testid={`entry-value-${name}`}
          >
            {masked ? DOTS : shown}
          </span>
        )
      }
    </FieldRow>
  )
}
