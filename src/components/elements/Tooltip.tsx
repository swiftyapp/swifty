import type { ReactNode } from 'react'

interface Props {
  content: ReactNode
  children: ReactNode
}

export default function Tooltip({ content, children }: Props) {
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
        className="pointer-events-none absolute inset-x-0 top-full z-50 mx-auto mt-2 w-max whitespace-nowrap rounded-sm bg-text px-2.5 py-1 text-base text-detail opacity-0 shadow-[var(--shadow)] transition-opacity delay-0 duration-150 group-hover/tt:animate-pop group-hover/tt:opacity-100 group-hover/tt:delay-300 group-hover/tt:[animation-delay:300ms] group-focus-within/tt:animate-pop group-focus-within/tt:opacity-100 group-focus-within/tt:delay-300 group-focus-within/tt:[animation-delay:300ms]"
      >
        {content}
      </div>
      {children}
    </div>
  )
}
