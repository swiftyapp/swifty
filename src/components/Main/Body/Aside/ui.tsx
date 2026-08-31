import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { copy } from '@/services/copy'
import { evaluate } from '@/services/strength'
import { t } from '@/i18n'
import { CopyGlyph } from '../../icons'

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']
const STRENGTH_COLOR = [
  'bg-bad',
  'bg-bad',
  'bg-warn',
  'bg-good',
  'bg-good'
]

// Shared presentation primitives for the detail pane. Every card, ledger cell,
// mono label and copy affordance in Show / Form / Audit routes through these so
// the token styling lives in one place.

export const MONO_LABEL =
  'font-mono text-[11px] uppercase tracking-[0.12em] text-text3'

// A bordered card surface on the gradient `--card` background.
export function Panel({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'overflow-hidden rounded-xl border border-line bg-[image:var(--card)]',
        className
      )}
    >
      {children}
    </div>
  )
}

// A 28px square icon button used for reveal/copy/edit affordances.
export function IconButton({
  onClick,
  title,
  active,
  className,
  children
}: {
  onClick?: () => void
  title?: string
  active?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        'grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-[7px] transition-colors',
        active
          ? 'bg-accent-soft text-accent'
          : 'text-text2 hover:bg-hover hover:text-text',
        className
      )}
    >
      {children}
    </button>
  )
}

// Copy-to-clipboard affordance wired to the existing clipboard service.
export function CopyButton({ value, title }: { value: string; title?: string }) {
  return (
    <IconButton title={title} onClick={() => copy(value)}>
      <CopyGlyph />
    </IconButton>
  )
}

// Five-segment strength meter driven by the existing zxcvbn `evaluate`.
export function StrengthBar({ password }: { password: string }) {
  if (!password) return null
  const { score } = evaluate(password)
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex flex-none gap-[3px]">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={cx(
              'h-[3px] w-[22px] rounded-full',
              i <= score ? STRENGTH_COLOR[score] : 'bg-line2'
            )}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] text-text3">
        {t(STRENGTH_LABELS[score])}
      </span>
    </div>
  )
}
