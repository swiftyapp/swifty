import { useStore } from '@/store'
import { t } from '@/i18n'
import { APP_NAME } from '@/lib/app'
import { useVaultMeta, vaultHome } from '@/hooks/useAuthMeta'

// Version and update state, pinned under the nav. The status line doubles as the
// "check for updates" control — there is no separate Updates section any more.
export default function Footer() {
  const meta = useVaultMeta()
  const update = useStore(state => state.update)
  const runUpdateCheck = useStore(state => state.runUpdateCheck)

  const status = update.readyVersion
    ? t('update ready')
    : update.status === 'checking'
      ? t('checking…')
      : update.status === 'error'
        ? t('check failed')
        : t('up to date')

  return (
    <div className="mt-4 flex flex-col items-start gap-0.5 font-mono text-xs text-text3">
      <div data-testid="settings-version">
        {meta?.version ? `${APP_NAME} ${meta.version}` : APP_NAME}
      </div>
      <button
        type="button"
        title={t('Check for updates')}
        data-testid="settings-update-status"
        onClick={() => runUpdateCheck()}
        className="cursor-pointer text-left transition-colors hover:text-text2"
      >
        {status}
        {meta && ` · ${vaultHome(meta.configured)}`}
      </button>
    </div>
  )
}
