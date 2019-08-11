import React from 'react'
import { ipcRenderer } from 'electron'

export default ({ display, onImport }) => {
  const chooseFle = () => {
    ipcRenderer.send('backup:file')
    ipcRenderer.once('backup:loaded', () => onImport())
  }

  const onGdriveSync = () => {
    ipcRenderer.send('vault:import')
  }

  if (!display) return null

  return (
    <>
      <div className="button choose-file" onClick={chooseFle}>
        Choose backup File
      </div>
      <p>or</p>
      <div className="button" onClick={() => onGdriveSync()}>
        Import from Google Drive
      </div>
    </>
  )
}
