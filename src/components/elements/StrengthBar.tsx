import { useStrength } from '@/hooks/useStrength'
import { t } from '@/i18n'
import Meter from './Meter'

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

export default function StrengthBar({ password }: { password: string }) {
  const strength = useStrength(password)
  if (!password) return null
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
