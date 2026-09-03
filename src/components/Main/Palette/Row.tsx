import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  // What the input points `aria-activedescendant` at — the focused row is never
  // the focused element, so this is the only way a reader is told about it.
  id: string
  focused: boolean
  onClick: () => void
  onHover: () => void
  // Rows come in two densities (entry vs command); the caller supplies its own
  // radius and padding.
  className?: string
  children: ReactNode
}

// Shared interaction shell for every palette row: one focus treatment (the
// prototype's best-match wash) and one hover. The border is always present so
// focusing a row never shifts the layout.
export default function Row({ id, focused, onClick, onHover, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Keep the keyboard-focused row visible when arrowing past the fold.
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  return (
    <div
      ref={ref}
      id={id}
      role="option"
      aria-selected={focused}
      // Every palette result (entry and command alike) flows through this
      // shell, so one hook here covers the whole result list.
      data-testid="palette-item"
      onClick={onClick}
      // mousemove, not mouseenter: a row sliding under a still cursor while the
      // list scrolls shouldn't steal focus from the arrow keys.
      onMouseMove={() => !focused && onHover()}
      className={cx(
        'flex cursor-pointer items-center gap-3 border',
        focused ? 'border-line2 bg-sel' : 'border-transparent hover:bg-hover',
        className
      )}
    >
      {children}
    </div>
  )
}
