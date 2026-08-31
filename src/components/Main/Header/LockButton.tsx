import { flowAuth } from '@/store'
import { lock } from '@/lib/commands'
import { t } from '@/i18n'
import IconButton from '@/components/elements/IconButton'
import { LockGlyph } from '../icons'

// Locks the vault straight from the top chrome (previously only reachable via
// Settings → Vault). Same action path as before: lock the vault, then drop the
// UI back to the auth flow.
export default function LockButton() {
  const onLock = () => {
    lock().finally(() => flowAuth(false))
  }

  return (
    <IconButton
      testid="lock-vault-button"
      onClick={onLock}
      title={t('Lock')}
      className="[-webkit-app-region:no-drag]"
    >
      <LockGlyph />
    </IconButton>
  )
}
