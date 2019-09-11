import React from 'react'
import Back from 'back.svg'

export default ({ display, onImport, goBack }) => {
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
      <br />
      <span className="navigate-back" onClick={() => goBack()}>
        <Back width="15" /> Go Back
      </span>
    </>
  )
}
