import { useTranslation } from 'react-i18next'
import { useStore, setBreachCheck, runAudit, setView, closeSettings } from '@/store'
import { vaultScore, auditCounts } from '@/utils/vaultScore'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Toggle from '@/components/elements/Toggle'
import Button from '@/components/elements/Button'
import ScoreRing from '@/components/elements/ScoreRing'
import { ROW_HAIRLINE } from '@/components/elements/tokens'

export default function Audit() {
  const { t } = useTranslation()
  const audit = useStore(state => state.audit)
  const breachCheck = useStore(state => state.breachCheck)

  const counts = audit ? auditCounts(audit) : { weak: 0, reused: 0, breached: 0 }
  const score = audit ? vaultScore(audit) : null

  const onBreachToggle = (next: boolean) => {
    setBreachCheck(next)
    runAudit()
  }

  const openHealth = () => {
    setView('health')
    closeSettings()
  }

  return (
    <>
      <SettingsGroup label={t('Monitors')}>
        <SettingsRow
          label={t('Breach monitoring')}
          description={t(
            'Only the first 5 characters of each password’s SHA-1 hash are sent (k-anonymity). Your password and its full hash never leave this device.'
          )}
          control={
            <Toggle
              name="breachCheck"
              checked={breachCheck}
              onChange={onBreachToggle}
              aria-label={t('Breach monitoring')}
              testid="settings-breach-toggle"
            />
          }
        />
        <SettingsRow label={t('Weak passwords')} description={t('Always on')} />
        <SettingsRow label={t('Reused passwords')} description={t('Always on')} />
      </SettingsGroup>

      <SettingsGroup label={t('Last audit')}>
        <div className={`flex items-center gap-3.5 px-4 py-3 ${ROW_HAIRLINE}`}>
          <div className="flex-none text-text2">
            <ScoreRing score={score} testid="settings-audit-score" />
          </div>
          <div
            data-testid="settings-audit-counts"
            className="min-w-0 flex-1 font-mono text-xs text-text2"
          >
            {counts.weak} {t('weak')} · {counts.reused} {t('reused')} · {counts.breached}{' '}
            {t('breached')}
          </div>
          <div className="flex flex-none items-center gap-3">
            <button
              type="button"
              data-testid="settings-open-health"
              onClick={openHealth}
              className="cursor-pointer text-base text-accent hover:underline"
            >
              {t('Open Vault Health')}
            </button>
            <Button
              variant="pale"
              size="md"
              onClick={() => runAudit()}
              testid="settings-audit-run"
            >
              {t('Run now')}
            </Button>
          </div>
        </div>
      </SettingsGroup>
    </>
  )
}
