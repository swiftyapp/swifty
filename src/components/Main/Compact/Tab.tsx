import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

// One destination in the bottom bar. 56px tall before the safe-area inset, so
// the tap target clears 44px even with the label under the glyph.
export default function Tab({
  label,
  testid,
  selected,
  onClick,
  children
}: {
  label: string
  testid: string
  selected?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 transition-colors',
        selected ? 'text-accent' : 'text-text3'
      )}
    >
      {children}
      <span className="w-full truncate text-center text-2xs font-medium">{label}</span>
    </button>
  )
}
