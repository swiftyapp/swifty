import { ipcRenderer } from 'electron'
require('application.css')

ipcRenderer.on('prompt-setup', (event, data) => {
  document.getElementById('setup').style.display = 'block'
  document.getElementById('prompt').style.display = 'none'
  document.getElementById('app').style.display = 'none'
})

ipcRenderer.on('prompt-password', (event, data) => {
  document.getElementById('setup').style.display = 'none'
  document.getElementById('prompt').style.display = 'block'
  document.getElementById('app').style.display = 'none'
})

ipcRenderer.on('invalid-password', (event, data) => {
  document.getElementById('invalid').innerText = 'invalid passsword'
})

ipcRenderer.on('launch-app', (event, data) => {
  document.getElementById('setup').style.display = 'none'
  document.getElementById('prompt').style.display = 'none'
  document.getElementById('app').style.display = 'block'
})

window.setupPassword = () => {
  let password = document.getElementById('setup_password').value
  ipcRenderer.send('password-setup', password)
}

window.enterPassword = value => {
  let password = document.getElementById('enter_password').value
  ipcRenderer.send('password-enter', password)
}
