import { useStore } from '@/store'
import { t } from '@/i18n'
import { vaultScore } from '@/utils/vaultScore'
import ScoreRing from '@/components/elements/ScoreRing'
import ViewButton from './ViewButton'

// The one rail tile whose glyph carries data: the audit score ring stands in for
// an icon, so it gets its own file rather than an inline ViewButton.
export default function VaultHealth() {
  const audit = useStore(state => state.audit)
  const score = audit ? vaultScore(audit) : null

  return (
    <ViewButton view="health" label={t('Vault Health')} testid="view-health">
      <ScoreRing score={score} size={28} testid="vault-health-score" />
    </ViewButton>
  )
}
