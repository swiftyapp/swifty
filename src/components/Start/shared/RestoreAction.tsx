import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { ChevronRightGlyph } from '@/components/Main/icons'

interface Props {
  /** The provider's mark, or a glyph for a source that has none. */
  mark: ReactNode
  title: string
  body: string
  /** Muted rather than a plate: the quieter of the two, glyph inked in text2. */
  muted?: boolean
  onClick: () => void
  testid?: string
}

// One way back into your own data, as a row you press: the provider's mark on
// a plate, what pressing it does, a line on what that means, and a chevron
// that leans into the press. It is the same weight as the "Start fresh" button
// above it on purpose — a real alternative, not a footnote — and it moves under
// the pointer (border, lift, chevron) so it never reads as a static card.
export default function RestoreAction({ mark, title, body, muted, onClick, testid }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'group flex w-full cursor-pointer items-center gap-3.5 rounded-lg border border-line bg-card p-3 pr-3.5 text-left',
        'shadow-[0_1px_2px_rgba(20,22,26,0.05),inset_0_1px_0_var(--topglow)]',
        'transition-[border-color,box-shadow,transform] hover:border-accent-line hover:shadow-[0_8px_22px_rgba(20,22,26,0.09),inset_0_1px_0_var(--topglow)] active:scale-[0.985] active:shadow-[0_1px_2px_rgba(20,22,26,0.05),inset_0_1px_0_var(--topglow)]'
      )}
    >
      <span
        className={cx(
          'grid h-11 w-11 flex-none place-items-center rounded-sm',
          muted
            ? 'bg-tile text-text2'
            : 'bg-detail ring-1 ring-line2 shadow-[0_1px_2px_rgba(20,22,26,0.06)]'
        )}
      >
        {mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-text">{title}</span>
        <span className="mt-0.5 block text-base text-text2">{body}</span>
      </span>
      <ChevronRightGlyph className="flex-none text-text3 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-accent" />
    </button>
  )
}
