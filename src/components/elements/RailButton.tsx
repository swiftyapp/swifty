import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import Tooltip from './Tooltip'

// THE 36px tile of the 56px left rail. One resting ink (text3), one hover
// (bg-hover + text2), one selected treatment (accent-soft wash + accent ink)
// with the 2x16 indicator bar sitting flush at the rail's left edge.
// `action` swaps in the filled accent wash for the rail's one verb (Add); it
// lives here rather than in a caller's `className` because `cx` concatenates
// without merging, so a passed-in `hover:bg-*` would race the resting one.
export default function RailButton({
  label,
  selected,
  action,
  onClick,
  testid,
  className,
  children,
}: {
  label: string
  selected?: boolean
  action?: boolean
  onClick?: () => void
  testid?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        data-testid={testid}
        onClick={onClick}
        className={cx(
          'relative grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition-colors',
          action
            ? 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg'
            : selected
              ? 'bg-accent-soft text-accent'
              : 'text-text3 hover:bg-hover hover:text-text2',
          className,
        )}
      >
        {selected && (
          <span className="absolute -left-2.5 top-2.5 h-4 w-0.5 rounded-full bg-accent" />
        )}
        {children}
      </button>
    </Tooltip>
  )
}
