import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CARD, MONO_LABEL } from './tokens'

interface Props {
  label: string
  children: ReactNode
  className?: string
}

// A titled block of SettingsRows: mono uppercase heading above one card. Groups
// own the gap below them so a settings page is just a stack of these.
export default function SettingsGroup({ label, children, className }: Props) {
  return (
    <section className={cx('mb-7', className)}>
      <div className={cx(MONO_LABEL, 'mb-2')}>{label}</div>
      <div className={CARD}>{children}</div>
    </section>
  )
}
