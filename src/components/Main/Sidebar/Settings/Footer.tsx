import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { APP_NAME } from '@/lib/app'
import { isMobile } from '@/lib/platform'
import { useVaultMeta, vaultHome } from '@/hooks/useAuthMeta'
import { META } from '@/components/elements/tokens'

// Version and update state, pinned under the nav. The status line doubles as the
// "check for updates" control — there is no separate Updates section any more.
// Two lines of the meta tier: the app and its version a shade up, since that is
// the line someone came here to read, the status muted beneath it.
export default function Footer() {
  const { t } = useTranslation()
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

  const home = meta ? vaultHome(meta.configured) : null

  return (
    <div className={`mt-4 flex flex-col items-start gap-0.5 ${META}`}>
      <div data-testid="settings-version" className="text-text2">
        {meta?.version ? `${APP_NAME} ${meta.version}` : APP_NAME}
      </div>
      {isMobile ? (
        // The App Store owns updates on mobile: there is nothing to check and no
        // version to report, so the line drops to plain text.
        home && <div data-testid="settings-vault-home">{home}</div>
      ) : (
        <button
          type="button"
          title={t('Check for updates')}
          data-testid="settings-update-status"
          onClick={() => runUpdateCheck()}
          className="cursor-pointer text-left transition-colors hover:text-text"
        >
          {status}
          {home && ` · ${home}`}
        </button>
      )}
    </div>
  )
}
