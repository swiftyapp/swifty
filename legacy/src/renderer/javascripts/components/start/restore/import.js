import React from 'react'
import Back from 'back.svg'

export default ({ display, onImport, goBack }) => {
  const { i18n } = window
  const chooseFle = () => {
    window.MessagesAPI.sendBackupSelect()
    window.MessagesAPI.onBackupLoaded(() => onImport())
  }
  if (!display) return null

  return (
    <>
      <div className="button choose-file" onClick={chooseFle}>
        {i18n('Choose backup File')}
      </div>
      <br />
      <span className="navigate-back" onClick={() => goBack()}>
        <Back width="15" /> {i18n('Go Back')}
      </span>
    </>
  )
}
