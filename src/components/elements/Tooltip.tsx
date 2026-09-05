import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  content: ReactNode
  children: ReactNode
  /**
   * Which edge of the panel is pinned to the trigger.
   *
   * `center` is the default and right for anything with room on both sides.
   * `end` pins the panel's right edge to the trigger's, for triggers in the
   * right-hand chrome: the panel is far wider than the 28px control it hangs
   * off, so centering one there sends half its width past the window edge,
   * where it is simply clipped -- there is no page to scroll into.
   */
  align?: 'center' | 'end'
}

export default function Tooltip({ content, children, align = 'center' }: Props) {
  return (
    <div className="group/tt relative">
      {/* The panel stays mounted, so `animate-pop` is scoped to the shown state
          (its `both` fill would otherwise pin opacity to 1 and never hide), and
          centering uses auto margins rather than a transform the pop would eat.
          Showing waits 300ms so a pointer crossing a row of tiles doesn't flash
          every tooltip on the way; hiding is immediate because the delay lives
          on the shown state only. The pop needs its own animation-delay — the
          `delay-*` utilities move transitions, not keyframes.
          Being mounted at all times also means it would sit in the AT tree
          permanently, duplicating the trigger's own `aria-label`, so it is
          hidden from it. */}
      <div
        role="tooltip"
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute top-full z-50 mt-2 w-max whitespace-nowrap rounded-sm bg-text px-2.5 py-1 text-base text-detail opacity-0 shadow-float transition-opacity delay-0 group-hover/tt:animate-pop group-hover/tt:opacity-100 group-hover/tt:delay-300 group-hover/tt:[animation-delay:300ms] group-focus-within/tt:animate-pop group-focus-within/tt:opacity-100 group-focus-within/tt:delay-300 group-focus-within/tt:[animation-delay:300ms]',
          align === 'end' ? 'right-0' : 'inset-x-0 mx-auto'
        )}
      >
        {content}
      </div>
      {children}
    </div>
  )
}
