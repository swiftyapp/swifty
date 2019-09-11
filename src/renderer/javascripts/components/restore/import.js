import React from 'react'

export default ({ display, onImport }) => {
  const chooseFle = () => {
    window.sendBackupSelect()
    window.onBackupLoaded(() => onImport())
  }
  if (!display) return null

  return (
    <>
      <div className="button choose-file" onClick={chooseFle}>
        Choose backup File
      </div>
    </>
  )
}
