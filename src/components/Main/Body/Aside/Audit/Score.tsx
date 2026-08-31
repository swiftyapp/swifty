import type { Audit, AuditItem } from '@/lib/commands'
import { t } from '@/i18n'

interface Props {
  audit: Audit
}

// Per-password health from the zxcvbn score (0-4 → 0-1), penalised for reuse
// and known breaches. Averaged and scaled to a 0-10 overall score.
const healthOf = (record: AuditItem) => {
  let value = record.score / 4
  if (record.isRepeating) value -= 0.25
  if (record.breached) value -= 0.5
  return Math.max(0, value)
}

export default function Score({ audit }: Props) {
  const records = Object.values(audit)
  const health = records.reduce((total, record) => total + healthOf(record), 0)
  const score = Math.round((health / records.length) * 100) / 10

  return (
    <div className="score">
      <div className="points">{score}</div>
      <div className="muted">{t('Overall Score')}</div>
    </div>
  )
}
