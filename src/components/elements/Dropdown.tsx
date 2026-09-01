import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface DropdownProps {
  onBlur: () => void
  // Placement against the nearest positioned ancestor (e.g. 'right-0 top-8').
  className?: string
  children: ReactNode
}

export function Dropdown({ onBlur, className, children }: DropdownProps) {
  return (
    <>
      <div
        className={cx(
          'animate-pop absolute z-20 min-w-[180px] overflow-hidden rounded-xl border border-line2 bg-detail py-1 text-text shadow-[var(--shadow)]',
          className
        )}
      >
        {children}
      </div>
      <div className="fixed inset-0 z-10" onClick={onBlur} />
    </>
  )
}

interface ItemProps {
  id?: string
  separated?: boolean
  // Destructive entry (delete, disconnect, ...): inked in the `bad` token.
  danger?: boolean
  onClick?: () => void
  children: ReactNode
}

export function DropdownItem({ id, separated, danger, onClick, children }: ItemProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={cx(
        'flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-base transition-colors hover:bg-hover',
        danger ? 'text-bad' : 'text-text2 hover:text-text',
        separated && 'mt-1 border-t border-line pt-2.5'
      )}
    >
      {children}
    </div>
  )
}
