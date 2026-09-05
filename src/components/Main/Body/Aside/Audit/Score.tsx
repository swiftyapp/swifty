import type { Audit } from '@/lib/commands'
import { useTranslation } from 'react-i18next'
import { vaultScore } from '@/utils/vaultScore'
import { MONO_LABEL } from '@/components/elements/tokens'

interface Props {
  audit: Audit
}

const R = 40
const CIRCUMFERENCE = 2 * Math.PI * R

const toneOf = (score: number) =>
  score >= 7 ? 'var(--c-good)' : score >= 4 ? 'var(--c-warn)' : 'var(--c-bad)'

export default function Score({ audit }: Props) {
  const { t } = useTranslation()
  // The shared 0-100 vault score, shown here on a 0-10 scale with one decimal.
  const score = (vaultScore(audit) ?? 0) / 10
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
          className="text-3xl font-semibold tracking-display text-text"
        >
          {score.toFixed(1)}
        </div>
        <div className={MONO_LABEL}>
          {t('Overall Score')}
        </div>
      </div>
    </div>
  )
}
