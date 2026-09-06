import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { ROW_HAIRLINE } from '@/components/elements/tokens'
import { ChevronRightGlyph } from '../../icons'

interface Props {
  label: string
  testid: string
  onClick: () => void
  /** The row's mark, at row size (16px). */
  glyph?: ReactNode
  /** The disclosure mark: this row pushes a screen rather than doing a thing. */
  chevron?: boolean
  /** The row's ink, for the one row that is a warning (Lock vault). */
  ink?: string
}

/**
 * A tappable row of a settings card.
 *
 * Not `elements/SettingsRow`: that one is a label/control pair 43px tall, which
 * is under the touch minimum and has no notion of the whole row being the
 * target. These rows *are* the target, so they are 48px and the button is the
 * row itself.
 */
export default function Row({
  label,
  testid,
  onClick,
  glyph,
  chevron,
  ink = 'text-text'
}: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'flex h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-base transition-colors',
        ink,
        ROW_HAIRLINE
      )}
    >
      {glyph}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {chevron && <ChevronRightGlyph className="flex-none text-text3" />}
    </button>
  )
}
