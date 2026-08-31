import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface DropdownProps {
  onBlur: () => void
  children: ReactNode
}

export function Dropdown({ onBlur, children }: DropdownProps) {
  return (
    <>
      <div className="absolute z-20 min-w-[180px] overflow-hidden rounded-xl border border-line2 bg-detail py-1 text-text shadow-[var(--shadow)]">
        {children}
      </div>
      <div className="fixed inset-0 z-10" onClick={onBlur} />
    </>
  )
}

interface ItemProps {
  id?: string
  separated?: boolean
  onClick?: () => void
  children: ReactNode
}

export function DropdownItem({ id, separated, onClick, children }: ItemProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={cx(
        'flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-text2 transition-colors hover:bg-hover hover:text-text',
        separated && 'mt-1 border-t border-line pt-2.5'
      )}
    >
      {children}
    </div>
  )
}
