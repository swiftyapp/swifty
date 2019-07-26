import { ipcMain, dialog } from 'electron'

const promptSetup = (window, manager) => {
  return new Promise(resolve => {
    window.webContents.send('setup')
    ipcMain.on('backup:file', () => {
      const result = dialog.showOpenDialog({ properties: ['openFile'] })
      result.then(({ filePaths }) => {
        manager.loadBackup(filePaths[0])
        window.webContents.send('backup:loaded')
      })
    })
    ipcMain.on('backup:password', (event, password) => {
      if (manager.validateBackup(password)) {
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
    window.enlarge()
    window.webContents.send('auth:success', manager.entries)
  })
}
