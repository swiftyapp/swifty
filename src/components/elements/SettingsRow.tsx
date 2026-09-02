import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { ROW_HAIRLINE } from './tokens'

interface Props {
  label: string
  description?: string
  // Right-aligned control (Toggle, Segmented, Button, Select, ...).
  control?: ReactNode
  // Full-width content below the label/control line, inside the same row — for
  // expandable extras such as an inline change-password form.
  children?: ReactNode
  testid?: string
}

// One row inside a SettingsGroup card: label (+ optional grey description) on
// the left, one control on the right, hairline below.
export default function SettingsRow({
  label,
  description,
  control,
  children,
  testid
}: Props) {
  return (
    <div data-testid={testid} className={cx('px-4 py-3', ROW_HAIRLINE)}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-base text-text">{label}</div>
          {description && <div className="text-base text-text2">{description}</div>}
        </div>
        {control && <div className="flex-none">{control}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
