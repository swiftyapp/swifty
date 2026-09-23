import { useTranslation } from 'react-i18next'
import { lockVault } from '@/store'
import RailButton from '@/components/elements/RailButton'
import { LockRailGlyph } from '../icons'

// Locks the vault from the rail's bottom group, beside Settings: the two
// things here are about the vault itself rather than what is in it, which is
// what the rail's foot is for. It used to sit in the top chrome next to the
// sync chip, where a verb and a status read as one pair.
//
// "Lock vault" is the one name for this action everywhere it appears — here,
// the command palette and the tray menu.
export default function Lock() {
  const { t } = useTranslation()
  return (
    <RailButton label={t('Lock vault')} onClick={() => void lockVault()} testid="lock-vault-button">
      <LockRailGlyph />
    </RailButton>
  )
}
