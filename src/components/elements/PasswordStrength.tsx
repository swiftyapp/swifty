import { cx } from '@/utils/cx'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { MIN_LENGTH } from '@/services/strength'
import { useStrength } from '@/hooks/useStrength'
import { MONO_META } from './tokens'

const LABELS: TKey[] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

// zxcvbn score 0..4 -> the token color of the lit segments.
const SCORE_COLOR = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-good', 'bg-good']

interface Props {
  password: string
}

// Non-punitive strength meter: a zxcvbn score bar plus guidance, no
// composition rules. Renders nothing until the user starts typing.
export default function PasswordStrength({ password }: Props) {
  const { t } = useTranslation()
  const strength = useStrength(password)

  if (!password) return null

  // The length hint is instant; the zxcvbn-derived score/feedback fills in once
  // the deferred evaluation lands, so typing never blocks on scoring.
  const score = strength?.score ?? null
  const tooShort = password.length < MIN_LENGTH
  const hint = tooShort
    ? t('Use at least {{count}} characters', { count: MIN_LENGTH })
    : strength?.warning || strength?.suggestions[0] || ''

  return (
    <div data-testid="password-strength" className="mx-auto mt-4 w-60">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={cx(
              'h-1 flex-1 rounded-full transition-colors',
              score !== null && i <= score ? SCORE_COLOR[score] : 'bg-line2'
            )}
          />
        ))}
      </div>
      <div className={`mt-1.5 flex justify-between gap-2 ${MONO_META}`}>
        <span data-testid="password-strength-label">
          {score !== null ? t(LABELS[score]) : ''}
        </span>
        {hint && <span className="text-right text-text3">{hint}</span>}
      </div>
    </div>
  )
}
