import { useState, useEffect } from 'react'
import { useStore, flowAuth } from '@/store'
import { syncConnect, syncDisconnect, exportVault, lock } from '@/lib/commands'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { H1, Section as Row, LABEL, DESC, DANGER } from './ui'
import { DownloadGlyph } from '../../icons'

interface Props {
  section: Section
}

export default function Vault({ section }: Props) {
  const [connecting, setConnecting] = useState(false)
  const [password, setPassword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const syncEnabled = useStore(state => state.sync.enabled)

  useEffect(() => setConnecting(false), [syncEnabled])

  const onConnect = () => {
    setConnecting(true)
    syncConnect()
  }

  const onLock = () => {
    lock().finally(() => flowAuth(false))
  }

  const onExport = () => {
    if (!password || exporting) return
    setExporting(true)
    setError(null)
    exportVault(password)
      .then(() => setPassword(''))
      .catch(() => setError(t('Invalid master password')))
      .finally(() => setExporting(false))
  }

  const syncAction = () => {
    if (syncEnabled) {
      return (
        <Button variant="danger" onClick={() => syncDisconnect()}>
          {t('Disconnect Google Drive')}
        </Button>
      )
    }
    return (
      <Button variant="pale" loading={connecting} onClick={onConnect}>
        {t('Connect your Google Drive')}
      </Button>
    )
  }

  if (section !== 'vault') return null

  return (
    <>
      <h1 className={H1}>{t('Vault Settings')}</h1>
      <Row>
        <div>
          <Button variant="pale" onClick={onLock}>
            {t('Lock Screen')}
          </Button>
        </div>
      </Row>
      <Row>
        <strong className={LABEL}>{t('Synchronize')}</strong>
        <p className={DESC}>{t('Synchronize your vault with Google Drive')}</p>
        <div>{syncAction()}</div>
      </Row>
      <Row>
        <strong className={LABEL}>{t('Backup')}</strong>
        <p className={DESC}>
          {t('Allows you to save a backup of your default vault file')}
        </p>
        <input
          type="password"
          name="export_password"
          placeholder={t('Master password')}
          className={`${inputClass} max-w-md`}
          value={password}
          disabled={exporting}
          onChange={event => {
            setError(null)
            setPassword(event.target.value)
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="pale"
            disabled={!password || exporting}
            onClick={onExport}
          >
            <DownloadGlyph size={16} /> {t('Save Vault File')}
          </Button>
          {error && <span className={DANGER}>{error}</span>}
        </div>
      </Row>
    </>
  )
}
