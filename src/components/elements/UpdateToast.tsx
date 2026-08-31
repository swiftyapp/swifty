import { useState } from 'react'
import { useStore } from '@/store'
import { restartForUpdate } from '@/services/autoUpdate'
import { t } from '@/i18n'
import DownloadIcon from '@/assets/images/download.svg?react'

// Bottom-right toast. Prefers the sticky "update ready → restart" prompt when one
// is staged; otherwise shows transient feedback from a manual check. Renders
// nothing when there is neither.
export default function UpdateToast() {
  const { readyVersion, readyNotes, status } = useStore(state => state.update)

  if (readyVersion) return <ReadyToast version={readyVersion} notes={readyNotes} />
  if (status) return <StatusToast status={status} />
  return null
}

function ReadyToast({ version, notes }: { version: string; notes: string | null }) {
  const dismiss = useStore(state => state.dismissUpdate)
  const [restarting, setRestarting] = useState(false)

  const onRestart = async () => {
    setRestarting(true)
    try {
      await restartForUpdate()
    } catch {
      // Relaunch shouldn't fail, but if it does don't trap the user — let them
      // dismiss and restart manually later.
      setRestarting(false)
    }
  }

  return (
    <div className="update-toast" role="alert">
      <DownloadIcon width="18" height="18" />
      <div className="body">
        <strong>{t('Update Ready')}</strong>
        <span>{t('Version {v} has been downloaded.').replace('{v}', version)}</span>
        {notes && <p className="notes">{notes}</p>}
        <div className="actions">
          <div className="button pale" onClick={restarting ? undefined : dismiss}>
            {t('Later')}
          </div>
          <div className="button" onClick={restarting ? undefined : onRestart}>
            {restarting ? t('Restarting…') : t('Restart Now')}
          </div>
        </div>
      </div>
    </div>
  )
}

const STATUS_COPY: Record<'checking' | 'uptodate' | 'error', string> = {
  checking: 'Checking for updates…',
  uptodate: "You're up to date.",
  error: 'Update check failed.'
}

function StatusToast({ status }: { status: 'checking' | 'uptodate' | 'error' }) {
  return (
    <div className="update-toast" role="status">
      <div className="body">
        <span>{t(STATUS_COPY[status])}</span>
      </div>
    </div>
  )
}
