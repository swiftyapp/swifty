import type { Audit, AuditItem } from '@/lib/commands'
import { t } from '@/i18n'

interface Props {
  audit: Audit
}

const scoreOf = (record: AuditItem) =>
  (record.isWeak ? 0.5 : 0) +
  (record.isShort ? 0.5 : 0) +
  (record.isRepeating ? 0.25 : 0) +
  (record.isOld ? 0.25 : 0)

export default function Score({ audit }: Props) {
  const records = Object.values(audit)
  const penalty = records.reduce((total, record) => total + scoreOf(record), 0)
  const score =
    Math.round(((records.length - penalty) / records.length) * 100) / 10

  return (
    <div className="score">
      <div className="points">{score}</div>
      <div className="muted">{t('Overall Score')}</div>
    </div>
  )
}
