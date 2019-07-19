import { ipcMain, dialog } from 'electron'

const promptSetup = (window, manager) => {
  return new Promise(resolve => {
    window.webContents.send('setup')
    ipcMain.on('backup:file', () => {
      dialog.showOpenDialog({ properties: ['openFile'] }, paths => {
        manager.loadBackup(paths[0])
        window.webContents.send('backup:loaded')
      })
    })
    ipcMain.on('backup:password', (event, password) => {
      if (manager.validateBackup(password)) {
        manager.storeBackup()
        window.resize({ width: 900, height: 700 }, true)
        window.webContents.send('auth:success', manager.entries)
      } else {
        window.webContents.send('backup:password:fail')
      }
    })
    ipcMain.on('setup:done', (event, data) => {
      return resolve(data)
    })
  })
}

export const showSetup = (window, manager) => {
  promptSetup(window, manager).then(password => {
    manager.setup(password)
    window.resize({ width: 900, height: 700 }, true)
    window.webContents.send('auth:success', manager.entries)
  })
}
