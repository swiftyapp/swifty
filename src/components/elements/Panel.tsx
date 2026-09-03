import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CARD } from './tokens'

// The card surface every grouped block sits on: detail field sets, the OTP
// dial, the audit score.
export default function Panel({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cx(CARD, className)}>{children}</div>
}
