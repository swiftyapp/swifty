import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface DropdownProps {
  onBlur: () => void
  // Placement against the nearest positioned ancestor (e.g. 'right-0 top-8').
  className?: string
  children: ReactNode
}

export function Dropdown({ onBlur, className, children }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  // Roving focus: unlike a radio group the arrows only *move*, they never
  // activate, so the menu holds no selection of its own.
  const move = (step: number) => {
    const all = items()
    if (all.length === 0) return
    const from = all.indexOf(document.activeElement as HTMLElement)
    all[(from + step + all.length) % all.length].focus()
  }

  // The menu takes focus on open so the keyboard lands inside it, and hands
  // focus back to whatever opened it on Escape.
  useEffect(() => {
    trigger.current = document.activeElement as HTMLElement | null
    items()[0]?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowUp':
        move(-1)
        break
      case 'Escape':
        // An open menu owns Escape. Modal and Generator listen on `window`
        // and Sheet on `document` — all ancestors of the React root — so
        // without this the one press would dismiss the overlay underneath too.
        event.stopPropagation()
        onBlur()
        trigger.current?.focus()
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <>
      <div
        ref={ref}
        role="menu"
        onKeyDown={onKeyDown}
        className={cx(
          'animate-pop absolute z-20 min-w-[180px] overflow-hidden rounded-xl border border-line2 bg-detail py-1 text-text shadow-[var(--shadow)]',
          className
        )}
      >
        {children}
      </div>
      <div
        data-testid="dropdown-scrim"
        className="fixed inset-0 z-10"
        onClick={onBlur}
      />
    </>
  )
}

interface ItemProps {
  id?: string
  separated?: boolean
  // Destructive entry (delete, disconnect, ...): inked in the `bad` token.
  danger?: boolean
  testid?: string
  onClick?: () => void
  children: ReactNode
}

export function DropdownItem({
  id,
  separated,
  danger,
  testid,
  onClick,
  children
}: ItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      id={id}
      data-testid={testid}
      onClick={onClick}
      className={cx(
        // The panel clips the global focus outline, so keyboard focus borrows
        // the hover treatment instead of inventing a ring of its own.
        'flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-base transition-colors hover:bg-hover focus-visible:bg-hover',
        danger ? 'text-bad' : 'text-text2 hover:text-text focus-visible:text-text',
        separated && 'mt-1 border-t border-line pt-2.5'
      )}
    >
      {children}
    </button>
  )
}
