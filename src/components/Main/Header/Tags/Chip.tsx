import { cx } from '@/utils/cx'

interface Props {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}

// A single filter chip: a token-bordered pill with a label and a mono count.
// Selected chips switch to the accent palette.
export default function Chip({ label, count, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-[25px] flex-none items-center gap-1.5 rounded-[7px] border px-[9px] text-[11px] whitespace-nowrap',
        selected
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-transparent text-text2 hover:border-line2'
      )}
    >
      <span>{label}</span>
      <span className="font-mono text-[11px] opacity-60">{count}</span>
    </button>
  )
}
