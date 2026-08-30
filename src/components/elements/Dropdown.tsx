import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface DropdownProps {
  onBlur: () => void
  children: ReactNode
}

export function Dropdown({ onBlur, children }: DropdownProps) {
  return (
    <>
      <div className="dropdown">{children}</div>
      <div className="dropdown-overlay" onClick={onBlur} />
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
      className={cx('dropdown-item', { separated })}
    >
      {children}
    </div>
  )
}
