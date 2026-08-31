import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

type Variant = 'primary' | 'ghost' | 'pale' | 'danger'
type Size = 'sm' | 'md'

interface Props {
  variant?: Variant
  size?: Size
  // Full-width auth call-to-action treatment (taller, mono uppercase) used by the
  // lock/setup/restore flows. Overrides `size`.
  block?: boolean
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
  testid?: string
}

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer select-none transition-[filter,background,opacity,color] disabled:cursor-default'

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[12px]',
  md: 'h-9 px-4 text-[13px]'
}

const blockStyle = 'w-full px-5 py-3 font-mono text-[13px] uppercase tracking-[0.12em]'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110',
  ghost: 'border border-line bg-tile text-text hover:bg-hover',
  pale: 'border border-line2 bg-field text-text2 hover:border-accent-line hover:text-text',
  danger: 'bg-bad text-white hover:brightness-110'
}

// Shared token-styled button. Serves both the full-width auth CTAs (`block`) and
// the inline settings/form actions (`size`, `loading`, `disabled`). Replaces the
// legacy `.button` SASS and unifies the two buttons that were introduced in
// parallel during the redesign.
export default function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  disabled,
  onClick,
  children,
  className,
  testid
}: Props) {
  const inert = disabled || loading
  return (
    <button
      type="button"
      data-testid={testid}
      disabled={inert}
      onClick={inert ? undefined : onClick}
      className={cx(
        base,
        block ? blockStyle : sizes[size],
        variants[variant],
        loading && 'pr-9',
        disabled && !loading && 'opacity-50',
        className
      )}
    >
      {children}
      {loading && (
        <span className="absolute right-3 h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-current" />
      )}
    </button>
  )
}
