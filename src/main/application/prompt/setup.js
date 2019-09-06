import { ipcMain, dialog } from 'electron'
import { Cryptor } from '@swiftyapp/cryptor'

export const promptSetup = (window, vault, sync) => {
  return new Promise(resolve => {
    window.webContents.send('setup')

    ipcMain.on('backup:select', () => {
      dialog
        .showOpenDialog({ properties: ['openFile'] })
        .then(({ filePaths, canceled }) => {
          if (canceled) return

          ipcMain.on('backup:password', (event, hashedSecret) => {
            const cryptor = new Cryptor(hashedSecret)
            if (vault.import(filePaths[0], cryptor)) {
              sync.initialize(vault, cryptor)
              return resolve()
            }
            window.webContents.send('backup:password:fail')
          })
          window.webContents.send('backup:loaded')
        })
        .catch(() => {})
    })

    ipcMain.on('setup:done', (event, hashedSecret) => {
      const cryptor = new Cryptor(hashedSecret)
      vault.setup(cryptor)
      sync.initialize(vault, cryptor)
      resolve()
    })
  })
}
