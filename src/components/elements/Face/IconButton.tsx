import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  onClick?: () => void
  title?: string
  active?: boolean
  testid?: string
  children: ReactNode
}

// The 28px icon affordance (see elements/IconButton) in a face's own inks: a
// reveal or a copy set on a plate follows the plate's tone rather than the
// pane's, so it reads as printed on the object instead of floating over it.
export default function FaceIconButton({ onClick, title, active, testid, children }: Props) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-sm text-(--face-ink2) transition-colors hover:bg-(--face-hover) hover:text-(--face-ink)',
        active && 'bg-(--face-hover) text-(--face-ink)'
      )}
    >
      {children}
    </button>
  )
}
