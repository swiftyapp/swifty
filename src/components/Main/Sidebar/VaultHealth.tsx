import { useStore, setView } from '@/store'
import { t } from '@/i18n'
import { vaultScore } from '@/utils/vaultScore'
import RailButton from '@/components/elements/RailButton'
import ScoreRing from '@/components/elements/ScoreRing'

export default function VaultHealth() {
  const audit = useStore(state => state.audit)
  const score = audit ? vaultScore(audit) : null
  const selected = useStore(state => state.ui.view === 'health')

  return (
    <RailButton
      label={t('Vault Health')}
      selected={selected}
      onClick={() => setView('health')}
      testid="view-health"
    >
      <ScoreRing score={score} size={28} testid="vault-health-score" />
    </RailButton>
  )
}
