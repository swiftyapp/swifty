import React, { useState } from 'react'
import classnames from 'classnames'

export default ({ display, onImport }) => {
  const [isLoading, setIsLoading] = useState(false)

  const chooseFle = () => {
    window.sendBackupSelect()
    window.onBackupLoaded(() => onImport())
  }

  const onGdriveSync = () => {
    setIsLoading(true)
    window.sendVaultImport()
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
