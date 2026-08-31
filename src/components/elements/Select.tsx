import type { ReactNode, ChangeEvent } from 'react'
import { cx } from '@/utils/cx'
import { ChevronDownGlyph } from '../Main/icons'
import { selectClass } from './formStyles'

interface Props {
  name?: string
  value: string
  disabled?: boolean
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  children: ReactNode
  className?: string
}

// Token-styled native <select> with a custom chevron. Native so keyboard and the
// test's `selectOptions` keep working.
export default function Select({
  name,
  value,
  disabled,
  onChange,
  children,
  className
}: Props) {
  return (
    <div className={cx('relative', className)}>
      <select
        name={name}
        value={value}
        disabled={disabled}
        onChange={onChange}
        className={selectClass}
      >
        {children}
      </select>
      <ChevronDownGlyph
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text3"
      />
    </div>
  )
}
