import { lockVault } from '@/store'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { LockGlyph } from '../icons'

// Locks the vault straight from the top chrome. "Lock vault" is the one name
// for this action everywhere it appears — here, the command palette and the
// tray menu.
export default function LockButton() {
  const onLock = () => {
    void lockVault()
  }

  return (
    <IconButton
      testid="lock-vault-button"
      onClick={onLock}
      title={t('Lock vault')}
    >
      <LockGlyph />
    </IconButton>
  )
}
