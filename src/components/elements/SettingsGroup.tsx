import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CARD, LABEL } from './tokens'

interface Props {
  label: string
  children: ReactNode
}

// A titled block of SettingsRows: uppercase micro heading above one card. Groups
// own the gap below them so a settings page is just a stack of these.
export default function SettingsGroup({ label, children }: Props) {
  return (
    <section className="mb-7">
      <div className={cx(LABEL, 'mb-2')}>{label}</div>
      <div className={CARD}>{children}</div>
    </section>
  )
}
