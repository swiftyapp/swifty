import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import classNames from 'classnames'
import DownloadIcon from 'download.svg'

const Vault = ({ section }) => {
  const { i18n } = window
  const [connecting, setConnecting] = useState(false)

  const syncEnabled = useSelector(state => state.sync.enabled)

  useEffect(() => setConnecting(false), [syncEnabled])

  const onClickSaveBackup = () => {
    window.MessagesAPI.sendBackupSave()
  }

  const onClickConnect = () => {
    setConnecting(true)
    window.MessagesAPI.sendVaultConnect()
  }

  const onClickDisconnect = () => {
    window.MessagesAPI.sendVaultDisconnect()
  }

  const syncAction = () => {
    if (syncEnabled) {
      return (
        <div className="button danger" onClick={onClickDisconnect}>
          {i18n('Disconnect Google Drive')}
        </div>
      )
    }
    return (
      <div
        className={classNames('button', { loading: connecting })}
        onClick={onClickConnect}
      >
        {i18n('Connect your Google Drive')}
      </div>
    )
  }

  if (section !== 'vault') return null

  return (
    <>
      <h1>{i18n('Vault Settings')}</h1>
      <div className="section">
        <strong>{i18n('Synchronize')}</strong>
        <div>{i18n('Synchronize your vault with Google Drive')}</div>
        {syncAction()}
      </div>

      <div className="section">
        <strong>{i18n('Backup')}</strong>
        <div>
          {i18n('Allows you to save a backup of your default vault file')}
        </div>
        <div className="button pale iconed" onClick={onClickSaveBackup}>
          <DownloadIcon width="16" height="16" /> {i18n('Save Vault File')}
        </div>
      </div>
    </>
  )
}

export default Vault
