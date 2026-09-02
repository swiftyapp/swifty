import { lockVault } from '@/store'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { LockGlyph } from '../icons'

// Locks the vault straight from the top chrome (previously only reachable via
// Settings → Vault).
export default function LockButton() {
  const onLock = () => {
    void lockVault()
  }

  return (
    <IconButton
      testid="lock-vault-button"
      onClick={onLock}
      title={t('Lock')}
    >
      <LockGlyph />
    </IconButton>
  )
}
