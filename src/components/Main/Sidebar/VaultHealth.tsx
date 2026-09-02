import { useStore, setView } from '@/store'
import { t } from '@/i18n'
import type { Audit, AuditItem } from '@/lib/commands'
import RailButton from '@/components/elements/RailButton'

// Per-password health from the zxcvbn score, penalised for reuse/breach —
// mirrors the audit Score card, scaled here to a 0-100 vault score.
const healthOf = (record: AuditItem) => {
  let value = record.score / 4
  if (record.isRepeating) value -= 0.25
  if (record.breached) value -= 0.5
  return Math.max(0, value)
}

const vaultScore = (audit: Audit): number | null => {
  const records = Object.values(audit)
  if (records.length === 0) return null
  const health = records.reduce((total, record) => total + healthOf(record), 0)
  return Math.round((health / records.length) * 100)
}

const RADIUS = 13
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ~82

export default function VaultHealth() {
  const audit = useStore(state => state.audit)
  const score = audit ? vaultScore(audit) : null
  const selected = useStore(state => state.ui.view === 'health')

  const ringColor =
    score === null || score >= 70
      ? 'var(--c-good)'
      : score >= 40
        ? 'var(--c-warn)'
        : 'var(--c-bad)'
  const dash = score === null ? 0 : (score / 100) * CIRCUMFERENCE

  return (
    <RailButton
      label={t('Vault Health')}
      selected={selected}
      onClick={() => setView('health')}
      testid="view-health"
    >
      <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          stroke="var(--c-line2)"
          strokeWidth="2"
        />
        {score !== null && (
          <circle
            cx="18"
            cy="18"
            r={RADIUS}
            stroke={ringColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
            transform="rotate(-90 18 18)"
          />
        )}
        <text
          data-testid="vault-health-score"
          x="18"
          y="21.5"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="currentColor"
        >
          {score === null ? '—' : score}
        </text>
      </svg>
    </RailButton>
  )
}
