import { useStore } from '@/store'
import { cx } from '@/utils/cx'
import Tooltip from '@/components/elements/Tooltip'

// Sync pill: a small status dot + mono label. Local-only vaults read as
// "Local"; connected vaults surface syncing / synced / error state.
export default function SyncIndicator() {
  const sync = useStore(state => state.sync)

  const dot = () => {
    if (!sync.enabled) return 'bg-text3'
    if (sync.inProgress) return 'bg-accent'
    return sync.success ? 'bg-good' : 'bg-bad'
  }

  const label = () => {
    if (!sync.enabled) return 'Local'
    if (sync.inProgress) return 'Syncing…'
    return sync.success ? 'Synced' : 'Sync error'
  }

  const message = () => {
    if (!sync.enabled) return 'Local vault'
    if (sync.inProgress) return 'Syncing...'
    if (sync.success) return 'Sync Successful'
    return sync.error || 'Something went wrong'
  }

  return (
    <Tooltip content={message()}>
      <div
        data-testid="sync-indicator"
        className="flex h-7 items-center gap-[7px] rounded-sm px-2.5 font-mono text-xs text-text3"
      >
        <span className={cx('h-[5px] w-[5px] flex-none rounded-full', dot())} />
        {label()}
      </div>
    </Tooltip>
  )
}
