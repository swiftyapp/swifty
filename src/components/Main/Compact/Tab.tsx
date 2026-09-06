import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

// One destination in the tab bar: 56px tall inside the 64px pill, so the tap
// target clears 44px even with the 10px label under the glyph. Selected is an
// accent pill of its own — a lit ink alone is too quiet on a glass surface.
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
        'flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors',
        selected ? 'bg-accent-soft text-accent' : 'text-text3'
      )}
    >
      {children}
      <span className="w-full truncate text-center text-2xs font-medium">{label}</span>
    </button>
  )
}
