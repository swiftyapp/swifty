import React, { useState } from 'react'
import { ipcRenderer } from 'electron'
import Error from './error'

export default ({ display, password }) => {
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState(null)

  const onChange = value => {
    setError(null)
    setConfirmation(value)
  }

  const onClick = () => {
    if (confirmation === password) {
      ipcRenderer.send('setup:done', password)
    } else {
      setError('Passwords do not match')
    }
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <div className="masterpass-input">
        <Error error={error} />
        <input
          type="password"
          placeholder="Confirm Master Password"
          onChange={event => onChange(event.currentTarget.value)}
        />
      </div>
      <br />
      <div className="button" onClick={onClick}>
        Finish
      </div>
    </div>
  )
}
