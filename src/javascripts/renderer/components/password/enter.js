import { ipcRenderer } from 'electron'
import React from 'react'

export default () => {
  const enterPassword = value => {
    let password = document.getElementById('enter_password').value
    ipcRenderer.send('password-enter', password)
  }

  return (
    <div id="prompt">
      <div id="title">Enter Master Password</div>
      <input type="password" id="enter_password" />
      <input type="button" onClick={enterPassword} value="Send" />
      <div id="invalid"></div>
    </div>
  )
}
