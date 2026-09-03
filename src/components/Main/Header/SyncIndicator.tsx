import { useStore, openSettings } from '@/store'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'

// Sync pill: a status dot + mono label surfacing syncing / synced / error.
//
// It renders only once sync is configured. A vault that was never connected has
// no sync state to report, so the pill would sit in the chrome reading "Local"
// forever — a permanent slot spent on a fact the user cannot act on. Clicking
// goes where the state is owned: Settings › Sync & devices.
export default function SyncIndicator() {
  const sync = useStore(state => state.sync)

  if (!sync.enabled) return null

  const dot = sync.inProgress ? 'bg-accent' : sync.success ? 'bg-good' : 'bg-bad'
  const label = sync.inProgress
    ? t('Syncing…')
    : sync.success
      ? t('Synced')
      : t('Sync error')
  const message = sync.inProgress
    ? t('Syncing…')
    : sync.success
      ? t('Sync Successful')
      : // The backend hands back an English message; it is a locale key too.
        t(sync.error || 'Something went wrong')

  return (
    <Tooltip content={message}>
      <button
        type="button"
        data-testid="sync-indicator"
        onClick={() => openSettings('sync')}
        className="flex h-7 items-center gap-[7px] rounded-sm px-2.5 font-mono text-xs text-text3 hover:text-text2"
      >
        <span className={cx('h-[5px] w-[5px] flex-none rounded-full', dot)} />
        {label}
      </button>
    </Tooltip>
  )
}
