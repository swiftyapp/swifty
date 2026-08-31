import { useMemo } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import { evaluate, MIN_LENGTH } from '@/services/strength'

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

// zxcvbn score 0..4 -> the token color of the lit segments.
const SCORE_COLOR = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-good', 'bg-good']

interface Props {
  password: string
}

// Non-punitive strength meter: a zxcvbn score bar plus guidance, no
// composition rules. Renders nothing until the user starts typing.
export default function PasswordStrength({ password }: Props) {
  const { score, warning, suggestions, tooShort } = useMemo(
    () => evaluate(password),
    [password]
  )

  if (!password) return null

  const hint = tooShort
    ? `${t('Use at least')} ${MIN_LENGTH} ${t('characters')}`
    : warning || suggestions[0] || ''

  return (
    <div className="mx-auto mt-4 w-60">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={cx(
              'h-1 flex-1 rounded-full transition-colors',
              i <= score ? SCORE_COLOR[score] : 'bg-line2'
            )}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 font-mono text-[11px] text-text3">
        <span>{t(LABELS[score])}</span>
        {hint && <span className="text-right text-text3">{hint}</span>}
      </div>
    </div>
  )
}
