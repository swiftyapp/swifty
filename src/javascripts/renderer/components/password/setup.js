import { ipcRenderer } from 'electron'
import React from 'react'

export default () => {

  const setupPassword = () => {
    let password = document.getElementById('setup_password').value
    ipcRenderer.send('setup:done', password)
  }

  return (
    <div id="setup">
      <div id="title">Setup Master Password</div>
      <input type="password" id="setup_password" />
      <input type="button" onClick={setupPassword} value="Send" />
    </div>
  )
}
