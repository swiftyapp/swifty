import { useTranslation } from 'react-i18next'
import { useVaultMeta } from '@/hooks/useAuthMeta'
import { cx } from '@/utils/cx'
import { META_TYPE } from './tokens'
import SyncIndicator from './SyncIndicator'

interface Props {
  className?: string
  /** Off where a sync chip already sits in the same screen (the phone's settings). */
  sync?: boolean
  /**
   * Makes the version a button that checks for updates (the settings nav's).
   * The outcome is the update toast's to report, so the footer stays bare.
   */
  onCheckUpdates?: () => void
}

// Where the vault lives, as a glyph, and the bare version: the footer of the
// lock screen and of the settings nav.
export default function VaultFooter({ className, sync = true, onCheckUpdates }: Props) {
  const { t } = useTranslation()
  const meta = useVaultMeta()
  if (!meta) return null

  const version = `${META_TYPE} text-text2`
  return (
    <div className={cx('flex items-center gap-1.5', className)}>
      {sync && <SyncIndicator side="top" />}
      {meta.version &&
        (onCheckUpdates ? (
          <button
            type="button"
            title={t('Check for updates')}
            data-testid="app-version"
            onClick={onCheckUpdates}
            className={`${version} cursor-pointer transition-colors hover:text-text`}
          >
            {meta.version}
          </button>
        ) : (
          <span data-testid="app-version" className={version}>
            {meta.version}
          </span>
        ))}
    </div>
  )
}
