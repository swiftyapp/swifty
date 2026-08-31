import { flowAuth } from '@/store'
import { lock } from '@/lib/commands'
import { t } from '@/i18n'
import { LockGlyph } from '../icons'

// Locks the vault straight from the top chrome (previously only reachable via
// Settings → Vault). Same action path as before: lock the vault, then drop the
// UI back to the auth flow.
export default function LockButton() {
  const onLock = () => {
    lock().finally(() => flowAuth(false))
  }

  return (
    <button
      type="button"
      data-testid="lock-vault-button"
      onClick={onLock}
      title={t('Lock')}
      className="grid h-7 w-7 place-items-center rounded-[7px] text-text2 transition-colors hover:bg-hover hover:text-text [-webkit-app-region:no-drag]"
    >
      <LockGlyph />
    </button>
  )
}
