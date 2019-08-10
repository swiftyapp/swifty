import React from 'react'
import { ipcRenderer, remote } from 'electron'
import { useSelector } from 'react-redux'
import DownloadIcon from 'download.svg'

const Vault = () => {
  const syncEnabled = useSelector(state => state.sync.enabled)

  const onClickSaveBackup = () => {
    remote.dialog.showSaveDialog().then(({ canceled, filePath }) => {
      if (!canceled) ipcRenderer.send('backup:save', filePath)
    })
  }

  const onClickConnect = () => {
    ipcRenderer.send('vault:sync:connect')
  }

  const onClickDisconnect = () => {
    ipcRenderer.send('vault:sync:disconnect')
  }

  const syncAction = () => {
    if (syncEnabled) {
      return (
        <div className="button danger" onClick={onClickDisconnect}>
          Disconnect Google Drive
        </div>
      )
    }
    return (
      <div className="button" onClick={onClickConnect}>
        Connect your Google Drive
      </div>
    )
  }

  return (
    <>
      <h1>Vault Settings</h1>
      <div className="section">
        <strong>Synchronize</strong>
        <div>Synchronize your vault with Google Drive</div>
        {syncAction()}
      </div>

      <div className="section">
        <strong>Backup</strong>
        <div>Allows you to save a backup of your default vault file</div>
        <div className="button iconed" onClick={onClickSaveBackup}>
          <DownloadIcon width="16" height="16" /> Save Vault File
        </div>
      </div>
    </>
  )
}

export default Vault
