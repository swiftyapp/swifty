import React from 'react'
import { ipcRenderer } from 'electron'

export default () => {
  const chooseFle = () => {
    ipcRenderer.send('choose:file')
  }

  return (
    <div className="lock-screen">
      <h2>Restore from Backup</h2>
      <div className="button" onClick={chooseFle}>
        Choose backup File
      </div>
    </div>
  )
}
