import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  content: ReactNode
  className?: string
  children: ReactNode
}

export default function Tooltip({ content, className, children }: Props) {
  return (
    <div className={cx('group/tt relative', className)}>
      {/* The panel stays mounted, so `animate-pop` is scoped to the hover state
          (its `both` fill would otherwise pin opacity to 1 and never hide), and
          centering uses auto margins rather than a transform the pop would eat. */}
      <div className="pointer-events-none absolute inset-x-0 top-full z-50 mx-auto mt-2 w-max whitespace-nowrap rounded-sm bg-text px-2.5 py-1 text-base text-detail opacity-0 shadow-[var(--shadow)] transition-opacity duration-150 group-hover/tt:animate-pop group-hover/tt:opacity-100">
        {content}
      </div>
      {children}
    </div>
  )
}
