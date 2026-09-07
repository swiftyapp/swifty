import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

// One destination in the tab bar: 56px tall inside the 64px pill, so the tap
// target clears 44px even with the 10px label under the glyph. Selected lights
// the ink; the accent-soft pill under it is the bar's one sliding lens, not
// the tab's own — see TabBar. `relative` puts the tab above that lens.
//
// Resting ink is the secondary tier (text2), not the tertiary the rail's tiles
// use: on the glass it measures ~6.4:1 light / ~6.1:1 dark, clearing WCAG AA's
// 4.5:1 for the 10px label. The tertiary ink sat at ~3.4:1 — fine for a bare
// 20px glyph (3:1), too pale for text that small, and it read washed out.
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
        'relative flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors',
        selected ? 'text-accent' : 'text-text2'
      )}
    >
      {children}
      <span className="w-full truncate text-center text-2xs font-medium">{label}</span>
    </button>
  )
}
