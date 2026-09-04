import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

type Variant = 'primary' | 'ghost' | 'pale' | 'danger'
// Two control heights, per the design system: md 28px (inline actions, pairs
// with 28px icon buttons) and lg 36px (form/CTA tier, pairs with 36px inputs).
type Size = 'md' | 'lg'

interface Props {
  variant?: Variant
  size?: Size
  // Full-width auth call-to-action treatment (taller, mono uppercase) used by the
  // lock/setup/restore flows. Overrides `size`.
  block?: boolean
  // Borderless keyboard hint rendered after the label (e.g. '⏎', '⌘⏎').
  kbd?: string
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
  testid?: string
}

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-sm text-base font-medium cursor-pointer select-none transition-[filter,background,opacity,color] disabled:cursor-default'

const sizes: Record<Size, string> = {
  md: 'h-7 px-3',
  lg: 'h-9 px-4'
}

const blockStyle = 'w-full px-5 py-3 font-mono uppercase tracking-label'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-[1.09]',
  ghost: 'border border-line bg-tile text-text hover:bg-hover',
  pale: 'border border-line2 bg-field text-text2 hover:border-accent-line hover:text-text',
  danger:
    'bg-bad text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-[1.09]'
}

// Shared token-styled button. Serves both the full-width auth CTAs (`block`) and
// the inline settings/form actions (`size`, `loading`, `disabled`).
export default function Button({
  variant = 'primary',
  size = 'lg',
  block,
  kbd,
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
      {/* A chip rather than dimmed text: on an accent fill, opacity is the one
          thing that makes the hint disappear. */}
      {kbd && (
        <span className="flex-none rounded-[4px] bg-[color-mix(in_srgb,currentColor_14%,transparent)] px-1 font-mono text-[11px] leading-4">
          {kbd}
        </span>
      )}
      {loading && (
        <span className="absolute right-3 h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-current" />
      )}
    </button>
  )
}
