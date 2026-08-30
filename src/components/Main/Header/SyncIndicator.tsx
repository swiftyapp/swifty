import { cx } from '@/utils/cx'
import { useAppSelector } from '@/store'
import Tooltip from '@/components/elements/Tooltip'
import Gdrive from '@/assets/images/google-drive-color.svg?react'
import HardDrive from '@/assets/images/hard-drive.svg?react'
import Tick from '@/assets/images/success_tick@2x.png'
import Exclamation from '@/assets/images/warning_exclamation@2x.png'

export default function SyncIndicator() {
  const sync = useAppSelector(state => state.sync)

  const icon = sync.enabled ? (
    <Gdrive width="18" height="18" />
  ) : (
    <HardDrive width="16" height="16" className="monochrome" />
  )

  const statusIcon = () => {
    if (sync.inProgress) return null
    if (sync.success)
      return <img src={Tick} width="11" height="10" className="success-icon" />
    return (
      <img src={Exclamation} width="4" height="10" className="error-icon" />
    )
  }

  const message = () => {
    if (sync.inProgress) return 'Syncing...'
    if (sync.success) return 'Sync Successful'
    return sync.error || 'Something went wrong'
  }

  return (
    <div
      className={cx('sync-indicator', {
        static: !sync.enabled,
        loading: sync.inProgress,
        success: sync.enabled && sync.success,
        failure: sync.enabled && !sync.success
      })}
    >
      <Tooltip content={message()}>
        <div className="spinner" />
        {statusIcon()}
        {icon}
      </Tooltip>
    </div>
  )
}
