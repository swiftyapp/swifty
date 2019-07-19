import React, { useState } from 'react'
import Error from './error'

export default ({ display, onEnter }) => {
  const [password, setPassword] = useState(null)
  const [error, setError] = useState(null)

  const onChange = value => {
    setError(null)
    setPassword(value)
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
      <div className="masterpass-input">
        <Error error={error} />
        <input
          type="password"
          placeholder="Set Master Password"
          onChange={event => onChange(event.currentTarget.value)}
        />
      </div>
      <br />
      <div className="button" onClick={onClick}>
        Continue
      </div>
    </div>
  )
}
