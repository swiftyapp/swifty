import { useState, useEffect } from 'react'
import { cx } from '@/utils/cx'
import { useStore } from '@/store'
import { syncConnect, syncDisconnect, exportVault } from '@/lib/commands'
import { SYNC_ENABLED } from '@/config'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import DownloadIcon from '@/assets/images/download.svg?react'

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
        <div className="button danger" onClick={() => syncDisconnect()}>
          {t('Disconnect Google Drive')}
        </div>
      )
    }
    return (
      <div className={cx('button', { loading: connecting })} onClick={onConnect}>
        {t('Connect your Google Drive')}
      </div>
    )
  }

  if (section !== 'vault') return null

  return (
    <>
      <h1>{t('Vault Settings')}</h1>
      {SYNC_ENABLED && (
        <div className="section">
          <strong>{t('Synchronize')}</strong>
          <div>{t('Synchronize your vault with Google Drive')}</div>
          {syncAction()}
        </div>
      )}
      <div className="section">
        <strong>{t('Backup')}</strong>
        <div>{t('Allows you to save a backup of your default vault file')}</div>
        <div className="threefour">
          <input
            type="password"
            name="export_password"
            placeholder={t('Master password')}
            value={password}
            disabled={exporting}
            onChange={event => {
              setError(null)
              setPassword(event.target.value)
            }}
          />
        </div>
        <div
          className={cx('button pale iconed', { disabled: !password || exporting })}
          onClick={onExport}
        >
          <DownloadIcon width="16" height="16" /> {t('Save Vault File')}
        </div>
        {error && <span className="danger">{error}</span>}
      </div>
    </>
  )
}
