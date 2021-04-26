import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'

export default ({ display, hashedSecret }) => {
  const { i18n } = window
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState(null)

  const onChange = event => {
    setError(null)
    setConfirmation(window.CryptorAPI.hashSecret(event.currentTarget.value))
  }

  const onSend = () => {
    if (hashedSecret === confirmation) {
      window.CryptorAPI.setupCryptor(hashedSecret)
      window.MessagesAPI.sendSetupDone(hashedSecret)
    } else {
      setError(i18n('Passwords do not match'))
    }
  }

  if (!display) return null

  return (
    <div className="bottom-lock">
      <Masterpass
        placeholder={i18n('Confirm Master Password')}
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onSend}>
        {i18n('Finish')}
      </div>
    </div>
  )
}
