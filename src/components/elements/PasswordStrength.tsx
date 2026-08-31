import { useMemo } from 'react'
import { t } from '@/i18n'
import { evaluate, MIN_LENGTH } from '@/services/strength'

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

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
    <div className="password-strength">
      <div className={`bar score-${score}`}>
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className={i <= score ? 'on' : ''} />
        ))}
      </div>
      <div className="label">
        <span>{t(LABELS[score])}</span>
        {hint && <span className="hint">{hint}</span>}
      </div>
    </div>
  )
}
