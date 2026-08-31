import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { copy } from '@/services/copy'
import { useStrength } from '@/hooks/useStrength'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { CopyGlyph } from '../../icons'

// Re-export so existing detail-pane imports keep working; the primitive itself
// now lives in elements/ and is shared with the header and Masterpass.
export { IconButton }

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

export const MONO_LABEL = 'font-mono text-xs uppercase tracking-label text-text3'

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
        'overflow-hidden rounded-lg border border-line bg-[image:var(--card)]',
        className
      )}
    >
      {children}
    </div>
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
  const strength = useStrength(password)
  if (!password) return null
  // Renders immediately as an empty bar and fills once the deferred score lands,
  // so scoring never blocks the detail panel from painting on selection.
  const score = strength?.score ?? null
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex flex-none gap-[3px]">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={cx(
              'h-[3px] w-[22px] rounded-full',
              score !== null && i <= score ? STRENGTH_COLOR[score] : 'bg-line2'
            )}
          />
        ))}
      </span>
      <span className="font-mono text-xs text-text3">
        {score !== null ? t(STRENGTH_LABELS[score]) : ''}
      </span>
    </div>
  )
}
