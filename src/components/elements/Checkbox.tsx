import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CheckGlyph } from '../Main/icons'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  /** The text beside the box, which is also the control's accessible name. */
  children: ReactNode
  disabled?: boolean
  name?: string
  testid?: string
}

// THE acknowledgement control: a 16px box that fills with the accent when
// ticked, with its label as one click target. A native `button
// role="checkbox"` handles Space and the global `:focus-visible` ring for free.
// Not a Toggle: a switch is a setting that stays, a checkbox is a yes to the
// one thing in front of you (an unencrypted export, say).
export default function Checkbox({ checked, onChange, children, disabled, name, testid }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      name={name}
      aria-checked={checked}
      disabled={disabled}
      data-testid={testid}
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex items-center gap-2.5 text-left text-base font-medium text-text',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer'
      )}
    >
      <span
        aria-hidden
        className={cx(
          'grid h-4 w-4 flex-none place-items-center rounded-xs border transition-colors',
          checked ? 'border-accent bg-accent text-accent-fg' : 'border-line2 bg-field'
        )}
      >
        {checked && <CheckGlyph size={11} stroke={3} />}
      </span>
      <span>{children}</span>
    </button>
  )
}
