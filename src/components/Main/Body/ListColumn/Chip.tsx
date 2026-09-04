import { cx } from '@/utils/cx'
import { CloseGlyph } from '../../icons'

interface Props {
  label: string
  count?: number
  selected: boolean
  onClick: () => void
  testid: string
  // Dismissible chip (the active tag filter): an × stands in for the count and
  // the whole chip is the hit area, so no button nests inside the button.
  dismiss?: boolean
  // Native tooltip, for a chip whose label doesn't say what clicking it does.
  title?: string
}

// A single filter chip: a token-bordered pill with a label and a mono count.
// Selected chips switch to the accent palette.
export default function Chip({ label, count, selected, onClick, testid, dismiss, title }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={cx(
        'flex h-6 flex-none items-center gap-1.5 rounded-sm border px-[9px] text-xs whitespace-nowrap',
        selected
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-transparent text-text2 hover:border-line2'
      )}
    >
      <span>{label}</span>
      {dismiss ? (
        <span className="opacity-60">
          <CloseGlyph size={12} />
        </span>
      ) : (
        <span
          data-testid={testid ? `${testid}-count` : undefined}
          className="font-mono text-xs opacity-60"
        >
          {count}
        </span>
      )}
    </button>
  )
}
