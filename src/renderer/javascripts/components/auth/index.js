import React, { useState } from 'react'
import Masterpass from '../elements/masterpass'
import Controls from '../elements/controls'
import img from 'swifty.png'

export const Auth = ({ touchID }) => {
  const [error, setError] = useState(null)

  const handleEnter = value => {
    const hashedSecret = window.CryptorAPI.hashSecret(value)
    window.CryptorAPI.setupCryptor(hashedSecret)
    window.MessagesAPI.sendAuthStart(hashedSecret)
    window.MessagesAPI.onAuthFail(() => {
      setError('Incorrect Master Password')
    })
  }

  const handleTouchId = () => {
    window.MessagesAPI.sendAuthTouchId()
  }

  const handleChange = () => {
    setError(null)
  }

  return (
    <>
      <Controls />
      <div className="lock-screen">
        <div className="top-lock">
          <img src={img} alt="" width="72" />
        </div>
        <div className="bottom-lock">
          <Masterpass
            touchID={touchID}
            error={error}
            onChange={handleChange}
            onEnter={handleEnter}
            onTouchID={handleTouchId}
          />
        </div>
      </div>
    </>
  )
}
