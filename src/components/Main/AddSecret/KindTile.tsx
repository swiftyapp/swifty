import { useTranslation } from 'react-i18next'
import type { Kind } from '@/kinds'
import { KIND_TINT } from '@/kinds/tint'
import { cx } from '@/utils/cx'

interface Props {
  kind: Kind
  onSelect: () => void
}

// One choice in the "Add a secret" grid: the kind's tinted glyph, its label and
// the one line that says what it holds. A real button, so ⏎/Space activate it
// and the global :focus-visible ring is all the focus styling it needs.
export default function KindTile({ kind, onSelect }: Props) {
  const { t } = useTranslation()
  const { Glyph } = kind

  return (
    <button
      type="button"
      data-testid={`add-kind-${kind.type}`}
      onClick={onSelect}
      className="flex cursor-pointer items-center gap-3.5 rounded-lg border border-line p-3.5 text-left transition-colors hover:border-line2 hover:bg-hover"
    >
      <span
        className={cx(
          'grid h-10 w-10 flex-none place-items-center rounded-sm',
          KIND_TINT[kind.tint]
        )}
      >
        <Glyph size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-medium text-text">{t(kind.label)}</span>
        {/* The card is sized so every description fits on one line; a longer
            translation ellipsizes rather than reflowing the tile. */}
        <span className="block truncate text-base text-text2">{t(kind.description)}</span>
      </span>
    </button>
  )
}
