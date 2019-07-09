import { ipcMain } from 'electron'

const promptSetup = window => {
  return new Promise((resolve, reject) => {
    window.webContents.send('setup')
    ipcMain.on('setup:done', (event, data) => {
      return resolve(data)
    })
  })
}

export const showSetup = (window, manager) => {
  promptSetup(window).then(password => {
    manager.setup(password)
    window.webContents.send('auth:success', manager.getItems())
  })
}
