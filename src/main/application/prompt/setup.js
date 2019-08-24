import { ipcMain, dialog } from 'electron'

export const promptSetup = (window, manager) => {
  return new Promise(resolve => {
    window.webContents.send('setup')

    ipcMain.on('backup:select', () => {
      dialog
        .showOpenDialog({ properties: ['openFile'] })
        .then(({ filePaths }) => {
          manager.loadBackup(filePaths[0])
          window.webContents.send('backup:loaded')
        })
        .catch(() => {})
    })

    ipcMain.on('backup:password', (event, password) => {
      if (manager.validateBackup(password)) return resolve(password)
      window.webContents.send('backup:password:fail')
    })

    ipcMain.on('setup:done', (event, data) => resolve(data))
  })
}
