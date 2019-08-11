import React, { useState } from 'react'
import Masterpass from 'components/elements/masterpass'
import { ipcRenderer } from 'electron'

export default ({ display }) => {
  const [password, setPassword] = useState()
  const [error, setError] = useState()

  const onChange = event => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const onClick = () => {
    ipcRenderer.send('backup:password', password)
    ipcRenderer.on('backup:password:fail', () => {
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
