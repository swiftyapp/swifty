import { ipcRenderer } from 'electron'
import React, { useState } from 'react'
import Masterpass from '../elements/masterpass'
import img from 'swifty.png'

export default () => {
  const [error, setError] = useState(null)

  const handleEnter = value => {
    ipcRenderer.send('auth:done', value)
    ipcRenderer.once('auth:fail', () => {
      setError('Incorrect Master Password')
    })
  }

  const handleChange = () => {
    setError(null)
  }

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <img src={img} alt="" width="120" />
      </div>
      <div className="bottom-lock">
        <Masterpass
          error={error}
          onChange={handleChange}
          onEnter={handleEnter}
        />
      </div>
    </div>
  )
}
