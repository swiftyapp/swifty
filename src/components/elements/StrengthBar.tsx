import { useStrength } from '@/hooks/useStrength'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import Meter from './Meter'
import { MONO_META } from './tokens'

const STRENGTH_LABELS: TKey[] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

export default function StrengthBar({ password }: { password: string }) {
  const { t } = useTranslation()
  const strength = useStrength(password)
  if (!password) return null
  const score = strength?.score ?? null
  return (
    <div className="flex items-center gap-2.5">
      <Meter level={score} />
      <span className={MONO_META}>
        {score !== null ? t(STRENGTH_LABELS[score]) : ''}
      </span>
    </div>
  )
}
