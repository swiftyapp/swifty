import { useEffect, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Masterpass from '@/components/elements/Masterpass'
import Button from '@/components/elements/Button'
import type { UnlockResult } from '@/api/types'
import { setupRestoreFromFile } from '@/api/setup'
import StepHeader from '../shared/StepHeader'
import DropZone from '../shared/DropZone'
import FoundFileCard from '../shared/FoundFileCard'
import TextLink from '../shared/TextLink'
import { COLUMN, FOOTNOTE } from '../shared/layout'
import { unsealError } from '../shared/errors'
import { fileNameOf } from '../shared/describe'

interface Props {
  onRestored: (result: UnlockResult) => Promise<void>
  /** A backup already chosen — the one the OS opened the app with. */
  initialPath?: string | null
}

// Restoring from a `.rowel` backup: pick the file, then unseal it with the
// master password it was sealed under. Desktop only — a phone has nowhere to
// drag a file from, and the backup it would need was saved on a machine that
// does.
export default function File({ onRestored, initialPath = null }: Props) {
  const { t } = useTranslation()
  const [path, setPath] = useState<string | null>(initialPath)
  // Also adopted when it changes while this screen is already up: the OS can
  // open a backup with the picker on screen, and `Start` then keeps this
  // component mounted rather than remounting it on the same `file` key.
  useEffect(() => {
    if (initialPath) setPath(initialPath)
  }, [initialPath])
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const restore = () => {
    if (busy || !path || !password) return
    setBusy(true)
    setError(null)
    setupRestoreFromFile(path, password)
      .then(onRestored)
      .catch((err: unknown) => {
        setBusy(false)
        setError(unsealError(t, err, t('Invalid password for backup')))
      })
  }

  if (path === null)
    return (
      <>
        <StepHeader
          eyebrow={t('Restore · Backup file')}
          title={t('Pick your backup')}
          body={t('Exported from Settings on another device.')}
        />
        <div className={`${COLUMN} mt-9`}>
          <DropZone onPick={setPath} />
        </div>
      </>
    )

  return (
    <>
      <StepHeader
        eyebrow={t('Restore · Backup file')}
        title={t('Unlock your backup')}
        body={t('Use the master password you had when this backup was made.')}
      />

      <div className={`${COLUMN} mt-9`}>
        <FoundFileCard
          where="disk"
          testid="restore-found-file"
          name={fileNameOf(path)}
          encrypted
        />

        <div className="mt-6">
          <Masterpass
            placeholder={t('Master password')}
            testid="restore-password-input"
            error={error}
            disabled={busy}
            onEnter={restore}
            onChange={change}
          />
        </div>

        <div className="mt-8">
          <Button block testid="restore-confirm-button" loading={busy} onClick={restore}>
            {t('Restore')}
          </Button>
        </div>
      </div>

      <div className={`${FOOTNOTE} flex justify-center`}>
        <TextLink testid="restore-change-file" onClick={() => setPath(null)}>
          {t('Pick another file')}
        </TextLink>
      </div>
    </>
  )
}
