import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'

export default ({ display }) => {
  const [hashedSecret, setHashedSecret] = useState()
  const [error, setError] = useState()

  const onChange = event => {
    setError(null)
    setHashedSecret(window.hashSecret(event.currentTarget.value))
  }

  const onClick = () => {
    window.sendBackupPassword(hashedSecret)
    window.onBackupPasswordFail(() => {
      setError('Invalid password for backup')
    })
  }

  if (!display) return null

  return (
    <>
      <Masterpass
        placeholder="Enter Master Password"
        error={error}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onClick}>
        Finish
      </div>
    </>
  )
}
