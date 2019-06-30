import { ipcRenderer } from 'electron'
require('application.css')

ipcRenderer.on('loaded', (event, data) => {
  document.getElementById('title').innerHTML = data.appName + ' App'
  document.getElementById('details').innerHTML = 'built with Electron v' + data.electronVersion
  document.getElementById('versions').innerHTML = 'running on Node v' + data.nodeVersion + ' and Chromium v' + data.chromiumVersion
})
