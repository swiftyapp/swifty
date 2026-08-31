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
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-text px-2.5 py-1 text-[12px] text-detail opacity-0 shadow-[var(--shadow)] transition-opacity duration-150 group-hover/tt:opacity-100">
        {content}
      </div>
      {children}
    </div>
  )
}
