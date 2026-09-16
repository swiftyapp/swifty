import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { ChevronRightGlyph } from '@/components/Main/icons'
import { META } from '@/components/elements/tokens'

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
// a plate, what pressing it does, a meta line on what that means, and a
// chevron that leans into the press. Shorter than the "Start fresh" button
// above it — the title is the row's one line of real type — so the two rows
// together weigh about what that one button does, and it moves under the
// pointer (border, lift, chevron) so it never reads as a static card.
export default function RestoreAction({ mark, title, body, muted, onClick, testid }: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line bg-card p-2 pr-3 text-left',
        'shadow-[0_1px_2px_rgba(20,22,26,0.05),inset_0_1px_0_var(--topglow)]',
        // The slow tier for the hover lift so it is seen moving, and a quick
        // snap on press so the row answers the finger rather than trailing it.
        'transition-[border-color,box-shadow,transform] duration-300 hover:border-accent-line hover:shadow-[0_8px_22px_rgba(20,22,26,0.09),inset_0_1px_0_var(--topglow)] active:scale-[0.985] active:shadow-[0_1px_2px_rgba(20,22,26,0.05),inset_0_1px_0_var(--topglow)] active:duration-100'
      )}
    >
      <span
        className={cx(
          'grid h-8 w-8 flex-none place-items-center rounded-sm',
          muted
            ? 'bg-tile text-text2'
            : 'bg-detail ring-1 ring-line2 shadow-[0_1px_2px_rgba(20,22,26,0.06)]'
        )}
      >
        {mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-text">{title}</span>
        <span className={`block ${META}`}>{body}</span>
      </span>
      <ChevronRightGlyph className="flex-none text-text3 transition-[color,transform] duration-300 group-hover:translate-x-0.5 group-hover:text-accent" />
    </button>
  )
}
