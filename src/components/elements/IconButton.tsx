import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

// THE 28px square icon affordance (reveal, copy, lock, theme, close, ...).
// One idle ink (text2), one hover (bg-hover + text), one active treatment
// (accent-soft wash) — the hover/active language for every naked icon control.
// `muted` drops the idle ink a tier (text3) for secondary in-field actions.
// `activeTone="plain"` is for a button whose active state is "its menu is
// open" rather than "this is on": the selection wash under the full ink, as
// the menus prototype draws its triggers, not the accent.
export default function IconButton({
  onClick,
  title,
  label,
  active,
  activeTone = 'accent',
  muted,
  expanded,
  disabled,
  className,
  testid,
  children
}: {
  onClick?: () => void
  title?: string
  // Accessible name; falls back to `title`.
  label?: string
  active?: boolean
  activeTone?: 'accent' | 'plain'
  muted?: boolean
  // Set only on a button that owns a popup menu: renders the disclosure pair
  // (`aria-haspopup` + `aria-expanded`). Left undefined, neither appears.
  expanded?: boolean
  // Kept on screen but inert, for an action the current state refuses.
  disabled?: boolean
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
        'grid h-7 w-7 flex-none place-items-center rounded-sm transition-colors',
        disabled
          ? 'cursor-default text-text3/40'
          : active
            ? activeTone === 'plain'
              ? 'cursor-pointer bg-sel text-text'
              : 'cursor-pointer bg-accent-soft text-accent'
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
