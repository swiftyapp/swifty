import { cx } from '@/utils/cx'

interface Props {
  label: string
  count: number
  selected: boolean
  onClick: () => void
  // The kind row and the tag row are both built from this chip but are
  // addressed separately by specs, so the hook is overridable.
  testid?: string
}

// A single filter chip: a token-bordered pill with a label and a mono count.
// Selected chips switch to the accent palette.
export default function Chip({ label, count, selected, onClick, testid = 'tag-item' }: Props) {
  return (
    <button
      type="button"
      // One chip per tag, so specs disambiguate on `data-tag` (the raw tag —
      // the visible label is the same string but sits beside a count span).
      data-testid={testid}
      data-tag={label}
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
