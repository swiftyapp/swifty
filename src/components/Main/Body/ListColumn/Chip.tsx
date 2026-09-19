import { cx } from '@/utils/cx'
import { CloseGlyph } from '../../icons'
import { META_TYPE } from '@/components/elements/tokens'

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

// A single filter chip: a token-bordered pill with a label and a muted count.
// Selected chips switch to the accent palette.
//
// On the phone it is the prototype's chip instead: a 32px pill at 13px, and
// the selected one inverted — ink behind ground-coloured text — rather than
// washed in accent, so the chosen filter is the one solid thing in the row.
export default function Chip({ label, count, selected, onClick, testid, dismiss, title }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={cx(
        `flex h-6 flex-none items-center gap-1.5 rounded-sm border px-[9px] ${META_TYPE} whitespace-nowrap`,
        'max-md:h-8 max-md:rounded-full max-md:px-3 max-md:text-base max-md:font-medium',
        selected
          ? 'border-accent-line bg-accent-soft text-accent max-md:border-text max-md:bg-text max-md:text-screen'
          : 'border-line bg-transparent text-text2 hover:border-line2 max-md:border-line2'
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
          className={`${META_TYPE} opacity-60`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
