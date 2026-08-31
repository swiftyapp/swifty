import { useState, useEffect } from 'react'
import { cx } from '@/utils/cx'
import { useAppSelector } from '@/store'
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
  const syncEnabled = useAppSelector(state => state.sync.enabled)

  useEffect(() => setConnecting(false), [syncEnabled])

  const onConnect = () => {
    setConnecting(true)
    syncConnect()
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
        <div className="button pale iconed" onClick={() => exportVault()}>
          <DownloadIcon width="16" height="16" /> {t('Save Vault File')}
        </div>
      </div>
    </>
  )
}
