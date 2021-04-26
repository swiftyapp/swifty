import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'
import Back from 'back.svg'

export default ({ display, onEnter, goBack }) => {
  const { i18n } = window
  const [hashedSecret, setHashedSecret] = useState(null)
  const [error, setError] = useState(null)

  const onChange = event => {
    setError(null)
    setHashedSecret(window.CryptorAPI.hashSecret(event.currentTarget.value))
  }

  const onSend = () => {
    if (hashedSecret) {
      onEnter(hashedSecret)
    } else {
      setError(i18n('Fill in the password'))
    }
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder={i18n('Set Master Password')}
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onSend}>
        {i18n('Continue')}
      </div>
      <span className="navigate-back" onClick={() => goBack()}>
        <Back width="15" /> {i18n('Go Back')}
      </span>
    </div>
  )
}
