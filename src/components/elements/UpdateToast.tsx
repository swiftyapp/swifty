import { useState } from 'react'
import { useStore } from '@/store'
import { restartForUpdate } from '@/services/autoUpdate'
import { t } from '@/i18n'
import Button from './Button'
import { DownloadGlyph } from '../Main/icons'

// Bottom-right toast. Prefers the sticky "update ready → restart" prompt when one
// is staged; otherwise shows transient feedback from a manual check. Renders
// nothing when there is neither.
export default function UpdateToast() {
  const { readyVersion, readyNotes, status } = useStore(state => state.update)

  if (readyVersion) return <ReadyToast version={readyVersion} notes={readyNotes} />
  if (status) return <StatusToast status={status} />
  return null
}

const shell =
  'fixed bottom-5 right-5 z-[1000] max-w-[340px] rounded-xl border border-line bg-detail text-text shadow-[var(--shadow)]'

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
    <div className={`${shell} flex gap-3 p-4`} role="alert">
      <DownloadGlyph size={18} className="mt-0.5 flex-none text-accent" />
      <div className="flex flex-col gap-1">
        <strong className="text-[14px]">{t('Update Ready')}</strong>
        <span className="text-[13px] text-text2">
          {t('Version {v} has been downloaded.').replace('{v}', version)}
        </span>
        {notes && (
          <p className="mt-1 whitespace-pre-wrap text-[12px] text-text3">{notes}</p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="pale"
            size="sm"
            onClick={restarting ? undefined : dismiss}
          >
            {t('Later')}
          </Button>
          <Button
            size="sm"
            loading={restarting}
            onClick={restarting ? undefined : onRestart}
          >
            {restarting ? t('Restarting…') : t('Restart Now')}
          </Button>
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
    <div className={`${shell} px-4 py-3`} role="status">
      <span className="text-[13px] text-text2">{t(STATUS_COPY[status])}</span>
    </div>
  )
}
