import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useVault, runAudit } from '@/store'
import { vaultScore } from '@/utils/vaultScore'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import ScoreRing from '@/components/elements/ScoreRing'
import { CARD, LABEL, META } from '@/components/elements/tokens'
import Stats from './Stats'

// The score in a word, on the bands ScoreRing inks its arc by: good from 70,
// warn from 40, bad below.
const verdict = (score: number | null, t: TFunction) =>
  score === null
    ? t('Not scanned yet')
    : score >= 70
      ? t('Strong')
      : score >= 40
        ? t('Fair')
        : t('Weak')

// A soft good-tinted light from the top-left corner, behind the ring.
const WASH =
  'bg-[radial-gradient(320px_200px_at_0_0,color-mix(in_srgb,var(--c-good)_12%,transparent),transparent)]'

export default function Hero() {
  const { t } = useTranslation()
  const audit = useVault(state => state.audit)
  const items = useVault(state => state.items.length)
  // The store keeps no in-flight flag for the audit, so the button keeps its own.
  const [running, setRunning] = useState(false)

  const score = audit ? vaultScore(audit) : null

  const run = () => {
    setRunning(true)
    void runAudit().finally(() => setRunning(false))
  }

  return (
    <div className={cx(CARD, 'relative mb-7')}>
      <div aria-hidden className={cx('pointer-events-none absolute inset-0', WASH)} />
      <div className="relative flex items-center gap-5 p-5">
        <div className="flex-none text-text">
          <ScoreRing score={score} size={76} testid="settings-audit-score" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={LABEL}>{t('Vault health')}</div>
          <div
            data-testid="settings-audit-verdict"
            className="mt-1 text-lg font-semibold tracking-display"
          >
            {verdict(score, t)}
          </div>
          <div className={cx(META, 'mt-0.5')}>{t('{{count}} items', { count: items })}</div>
        </div>
        <Button size="md" loading={running} onClick={run} testid="settings-audit-run">
          {t('Run now')}
        </Button>
      </div>
      <Stats audit={audit} />
    </div>
  )
}
