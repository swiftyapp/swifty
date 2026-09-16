import { cx } from '@/utils/cx'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { MIN_LENGTH } from '@/services/strength'
import { useStrength } from '@/hooks/useStrength'
import Meter from './Meter'
import { LEVEL_INK } from './levels'
import { META } from './tokens'

const LABELS: TKey[] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

interface Props {
  password: string
  /**
   * What the last attempt to continue found wrong with the password. Takes the
   * hint's place, in red, so the field is told one thing at a time rather than
   * the same thing twice.
   */
  error?: string | null
}

// Non-punitive strength meter, one line: the five-segment readout with its
// verdict on the left, and on the right the one hint worth acting on — or the
// error that stands in for it. No composition rules. Renders nothing until
// there is something to say.
export default function PasswordStrength({ password, error }: Props) {
  const { t } = useTranslation()
  const strength = useStrength(password)

  if (!password && !error) return null

  // The length hint is instant; the zxcvbn-derived score/feedback fills in once
  // the deferred evaluation lands, so typing never blocks on scoring.
  const score = password ? (strength?.score ?? null) : null
  const tooShort = password.length < MIN_LENGTH
  const hint = tooShort
    ? t('Use at least {{count}} characters', { count: MIN_LENGTH })
    : strength?.warning || strength?.suggestions[0] || ''

  return (
    <div data-testid="password-strength" className={`flex items-center gap-2.5 ${META}`}>
      <Meter level={score} />
      <span
        data-testid="password-strength-label"
        className={cx('flex-none', score !== null && LEVEL_INK[score])}
      >
        {score !== null ? t(LABELS[score]) : ''}
      </span>
      <span className={cx('ml-auto min-w-0 truncate text-right', error && 'text-bad')}>
        {error ?? hint}
      </span>
    </div>
  )
}
