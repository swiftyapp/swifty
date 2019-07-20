import React from 'react'
import { ipcRenderer } from 'electron'

export default ({ display, onImport }) => {
  const chooseFle = () => {
    ipcRenderer.send('backup:file')
    ipcRenderer.once('backup:loaded', () => onImport())
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <div className="button choose-file" onClick={chooseFle}>
        Choose backup File
      </div>
    </div>
  )
}
