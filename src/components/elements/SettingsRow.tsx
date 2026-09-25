import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { ROW_HAIRLINE } from './tokens'

interface Props {
  label: ReactNode
  // Text, or text with something inline in it (a chip after the label, a
  // "How it works" link closing the description).
  description?: ReactNode
  // Right-aligned control (Toggle, Segmented, Button, Select, ...).
  control?: ReactNode
  /**
   * The row's mark, at row size (16px), drawn in a 32px tile on the left. A
   * card of rows with tiles reads as a list of things rather than a form.
   */
  icon?: ReactNode
  /**
   * The tile lit in the accent wash: the row's setting is on, and the mark
   * says so before the control does (a biometric unlock that is enrolled).
   */
  iconActive?: boolean
  // Full-width content below the label/control line, inside the same row — for
  // expandable extras such as an inline change-password form.
  children?: ReactNode
  testid?: string
}

// One row inside a SettingsGroup card: an optional icon tile, label (+ optional
// grey description) on the left, one control on the right, hairline below.
export default function SettingsRow({
  label,
  description,
  control,
  icon,
  iconActive,
  children,
  testid
}: Props) {
  return (
    <div data-testid={testid} className={cx('px-4 py-3.5', ROW_HAIRLINE)}>
      <div className="flex items-center gap-3.5">
        {icon && (
          <div
            className={cx(
              'grid h-8 w-8 flex-none place-items-center rounded-sm transition-colors',
              iconActive ? 'bg-accent-soft text-accent' : 'bg-tile text-text2'
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-text">{label}</div>
          {description && <div className="mt-0.5 text-base text-text2">{description}</div>}
        </div>
        {control && <div className="flex-none">{control}</div>}
      </div>
      {/* Unfolded content lines up under the label, past the tile. */}
      {children && <div className={cx('mt-3', !!icon && 'pl-[46px]')}>{children}</div>}
    </div>
  )
}
