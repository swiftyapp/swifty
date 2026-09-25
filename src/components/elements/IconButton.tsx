import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

const SIZE: Record<28 | 32, string> = {
  28: 'h-7 w-7',
  32: 'h-8 w-8'
}

export default function IconButton({
  onClick,
  title,
  label,
  active,
  muted,
  expanded,
  disabled,
  size = 28,
  className,
  testid,
  children
}: {
  onClick?: () => void
  title?: string
  label?: string
  active?: boolean
  muted?: boolean
  expanded?: boolean
  disabled?: boolean
  size?: 28 | 32
  className?: string
  testid?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label ?? title}
      aria-haspopup={expanded === undefined ? undefined : 'menu'}
      aria-expanded={expanded}
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'grid flex-none place-items-center rounded-sm transition-colors',
        SIZE[size],
        disabled
          ? 'cursor-default text-text3/40'
          : expanded
            ? 'cursor-pointer bg-sel text-text'
            : active
              ? 'cursor-pointer bg-accent-soft text-accent'
              : muted
                ? 'cursor-pointer text-text3/70 hover:bg-hover hover:text-text2'
                : 'cursor-pointer text-text2 hover:bg-hover hover:text-text',
        className
      )}
    >
      {children}
    </button>
  )
}
