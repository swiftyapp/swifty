import { ipcMain, dialog } from 'electron'

export const promptSetup = (window, manager) => {
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
        return resolve(password)
      } else {
        window.webContents.send('backup:password:fail')
      }
    })
    ipcMain.on('setup:done', (event, data) => {
      return resolve(data)
    })
  })
}
