import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  content: ReactNode
  className?: string
  children: ReactNode
}

export default function Tooltip({ content, className, children }: Props) {
  return (
    <div className={cx('tooltip-context', className)}>
      <div className="tooltip">{content}</div>
      {children}
    </div>
  )
}
