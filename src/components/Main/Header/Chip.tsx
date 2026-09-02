import { cx } from '@/utils/cx'

interface Props {
  label: string
  count: number
  selected: boolean
  onClick: () => void
  testid: string
}

// A single filter chip: a token-bordered pill with a label and a mono count.
// Selected chips switch to the accent palette.
export default function Chip({ label, count, selected, onClick, testid }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'flex h-6 flex-none items-center gap-1.5 rounded-sm border px-[9px] text-xs whitespace-nowrap',
        selected
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-transparent text-text2 hover:border-line2'
      )}
    >
      <span>{label}</span>
      <span className="font-mono text-xs opacity-60">{count}</span>
    </button>
  )
}
