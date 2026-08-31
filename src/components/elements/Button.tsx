import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface Props {
  children: ReactNode
  variant?: 'primary' | 'ghost'
  testid?: string
  onClick?: () => void
}

// Shared auth-flow button. `primary` is the accent call-to-action; `ghost` is
// a quiet secondary (restore / choose file). Styled through design tokens so
// both themes render correctly. Not the legacy `.button` SASS class.
export default function Button({
  children,
  variant = 'primary',
  testid,
  onClick
}: Props) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cx(
        'w-full rounded-lg border px-5 py-3 font-mono text-[13px] uppercase tracking-[0.12em] transition-colors',
        variant === 'primary'
          ? 'border-transparent bg-accent text-accent-fg hover:opacity-90'
          : 'border-line bg-tile text-text hover:bg-hover'
      )}
    >
      {children}
    </button>
  )
}
