import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'

export default ({ display, password }) => {
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState(null)

  const onChange = event => {
    setError(null)
    setConfirmation(window.hashSecret(event.currentTarget.value))
  }

  const onClick = () => {
    if (confirmation === password) {
      window.sendSetupDone(password)
    } else {
      setError('Passwords do not match')
    }
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder="Confirm Master Password"
        error={error}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onClick}>
        Finish
      </div>
    </div>
  )
}
