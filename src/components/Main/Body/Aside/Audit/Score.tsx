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

const R = 40
const CIRCUMFERENCE = 2 * Math.PI * R

const toneOf = (score: number) =>
  score >= 7 ? 'var(--c-good)' : score >= 4 ? 'var(--c-warn)' : 'var(--c-bad)'

export default function Score({ audit }: Props) {
  const records = Object.values(audit)
  const health = records.reduce((total, record) => total + healthOf(record), 0)
  const score = Math.round((health / records.length) * 100) / 10
  const dash = `${(score / 10) * CIRCUMFERENCE} ${CIRCUMFERENCE}`

  return (
    <div className="relative grid h-[132px] w-[132px] place-items-center">
      <svg
        width="132"
        height="132"
        viewBox="0 0 96 96"
        fill="none"
        className="absolute inset-0 -rotate-90"
      >
        <circle cx="48" cy="48" r={R} stroke="var(--c-line2)" strokeWidth="4" />
        <circle
          cx="48"
          cy="48"
          r={R}
          stroke={toneOf(score)}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
      </svg>
      <div className="text-center">
        {/* 34px is a documented one-off: the dial numeral sits above the 24px
            display tier so it fills the ring. */}
        <div
          data-testid="audit-score"
          className="text-[34px] font-semibold tracking-display text-text"
        >
          {score}
        </div>
        <div className="font-mono text-xs uppercase tracking-label text-text3">
          {t('Overall Score')}
        </div>
      </div>
    </div>
  )
}
