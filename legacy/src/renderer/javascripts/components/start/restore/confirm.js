import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'

export default ({ display }) => {
  const { i18n } = window
  const [hashedSecret, setHashedSecret] = useState()
  const [error, setError] = useState()

  const onChange = event => {
    setError(null)
    setHashedSecret(window.CryptorAPI.hashSecret(event.currentTarget.value))
  }

  const onSend = () => {
    window.CryptorAPI.setupCryptor(hashedSecret)
    window.MessagesAPI.sendBackupPassword(hashedSecret)
    window.MessagesAPI.onBackupPasswordFail(() => {
      setError(i18n('Invalid password for backup'))
    })
  }

  if (!display) return null

  return (
    <>
      <Masterpass
        placeholder={i18n('Enter Master Password')}
        error={error}
        onEnter={onSend}
        onChange={onChange}
      />
      <br />
      <div className="button" onClick={onSend}>
        {i18n('Finish')}
      </div>
    </>
  )
}
