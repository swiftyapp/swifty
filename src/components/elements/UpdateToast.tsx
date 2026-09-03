import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TKey } from '@/i18n'
import { useStore } from '@/store'
import { restartForUpdate } from '@/services/autoUpdate'
import Button from './Button'
import { TOAST } from './tokens'
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

const shell = `${TOAST} bottom-5 right-5`

function ReadyToast({ version, notes }: { version: string; notes: string | null }) {
  const { t } = useTranslation()
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
        <strong className="text-base">{t('Update Ready')}</strong>
        <span className="text-base text-text2">
          {t('Version {{v}} has been downloaded.', { v: version })}
        </span>
        {notes && (
          <p className="mt-1 whitespace-pre-wrap text-base text-text3">{notes}</p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="pale"
            size="md"
            onClick={restarting ? undefined : dismiss}
          >
            {t('Later')}
          </Button>
          <Button
            size="md"
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

const STATUS_COPY: Record<'checking' | 'uptodate' | 'error', TKey> = {
  checking: 'Checking for updates…',
  uptodate: "You're up to date.",
  error: 'Update check failed.'
}

function StatusToast({ status }: { status: 'checking' | 'uptodate' | 'error' }) {
  const { t } = useTranslation()
  return (
    <div className={`${shell} px-4 py-3`} role="status">
      <span className="text-base text-text2">{t(STATUS_COPY[status])}</span>
    </div>
  )
}
