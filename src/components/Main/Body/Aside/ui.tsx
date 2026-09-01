import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { useCopied } from '@/hooks/useCopied'
import { useStrength } from '@/hooks/useStrength'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
<<<<<<< HEAD
import { CheckGlyph, CopyGlyph } from '../../icons'
=======
import Meter from '@/components/elements/Meter'
import { CopyGlyph } from '../../icons'
>>>>>>> feat/generator-dialog

// Re-export so existing detail-pane imports keep working; the primitive itself
// now lives in elements/ and is shared with the header and Masterpass.
export { IconButton }

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

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

// Copy-to-clipboard affordance wired to the existing clipboard service. The
// glyph flips to a check for a beat so the row confirms locally, alongside the
// global "Copied to Clipboard" toast.
export function CopyButton({ value, title }: { value: string; title?: string }) {
  const { copied, copy } = useCopied()
  return (
    <IconButton title={copied ? t('Copied') : title} onClick={() => copy(value)}>
      {copied ? <CheckGlyph className="text-good" /> : <CopyGlyph />}
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
      <Meter level={score} />
      <span className="font-mono text-xs text-text3">
        {score !== null ? t(STRENGTH_LABELS[score]) : ''}
      </span>
    </div>
  )
}
