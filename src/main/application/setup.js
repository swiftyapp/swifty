import { ipcMain, dialog } from 'electron'

const promptSetup = window => {
  return new Promise(resolve => {
    window.webContents.send('setup')
    ipcMain.on('choose:file', () => {
      dialog.showOpenDialog({ properties: ['openFile'] }, paths => {
        console.log(paths[0])
      })
    })
    ipcMain.on('setup:done', (event, data) => {
      return resolve(data)
    })
  })
}

export const showSetup = (window, manager) => {
  promptSetup(window).then(password => {
    manager.setup(password)
    window.resize({ width: 900, height: 700 }, true)
    window.webContents.send('auth:success', manager.entries)
  })
}
