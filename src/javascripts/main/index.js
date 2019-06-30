import electron from 'electron'
import path from 'path'

electron.app.on('ready', function() {
  let window = new electron.BrowserWindow({
    title: SETTINGS.name,
    width: SETTINGS.width,
    height: SETTINGS.height,
    webPreferences: {
      nodeIntegration: true
    }
  })

  window.loadURL(`file://${path.join(__dirname, '..', '..')}/index.html`)

  window.webContents.on('did-finish-load', function(){
    window.webContents.send('loaded', {
      appName: SETTINGS.name,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromiumVersion: process.versions.chrome
    })
  })

  window.on('closed', function() {
    window = null
  })
})
