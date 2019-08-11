import React, { useState } from 'react'
import classnames from 'classnames'
import { ipcRenderer } from 'electron'

export default ({ display, onImport }) => {
  const [isLoading, setIsLoading] = useState(false)

  const chooseFle = () => {
    ipcRenderer.send('backup:file')
    ipcRenderer.once('backup:loaded', () => onImport())
  }

  const onGdriveSync = () => {
    setIsLoading(true)
    ipcRenderer.send('vault:import')
  }

  if (!display) return null

  return (
    <>
      <div className="button choose-file" onClick={chooseFle}>
        Choose backup File
      </div>
      <p>or</p>
      <div
        className={classnames('button', { loading: isLoading })}
        onClick={() => onGdriveSync()}
      >
        Import from Google Drive
      </div>
    </>
  )
}
