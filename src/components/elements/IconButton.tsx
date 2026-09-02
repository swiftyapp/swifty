import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

// THE 28px square icon affordance (reveal, copy, lock, theme, close, ...).
// One idle ink (text2), one hover (bg-hover + text), one active treatment
// (accent-soft wash) — the hover/active language for every naked icon control.
// `muted` drops the idle ink a tier (text3) for secondary in-field actions.
export default function IconButton({
  onClick,
  title,
  label,
  active,
  muted,
  className,
  testid,
  children
}: {
  onClick?: () => void
  title?: string
  // Accessible name; falls back to `title`.
  label?: string
  active?: boolean
  muted?: boolean
  className?: string
  testid?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label ?? title}
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-sm transition-colors',
        active
          ? 'bg-accent-soft text-accent'
          : muted
            ? 'text-text3/70 hover:bg-hover hover:text-text2'
            : 'text-text2 hover:bg-hover hover:text-text',
        className
      )}
    >
      {children}
    </button>
  )
}
