import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'

export default ({ display, onEnter }) => {
  const [password, setPassword] = useState(null)
  const [error, setError] = useState(null)

  const onChange = event => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const onClick = () => {
    if (password) {
      onEnter(password)
    } else {
      setError('Fill in the password')
    }
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder="Set Master Password"
        error={error}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onClick}>
        Continue
      </div>
    </div>
  )
}
