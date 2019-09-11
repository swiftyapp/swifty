import { Cryptor } from '@swiftyapp/cryptor'
import { ipcMain, dialog } from 'electron'

export const onBackupSave = vault => {
  ipcMain.on('backup:save', (event, filepath) => {
    vault.export(filepath)
  })
}

export const onBackupSelect = (vault, sync, window, callback) => {
  ipcMain.on('backup:select', () => {
    dialog
      .showOpenDialog({ properties: ['openFile'] })
      .then(({ filePaths, canceled }) => {
        if (canceled) return

        ipcMain.on('backup:password', (event, hashedSecret) => {
          const cryptor = new Cryptor(hashedSecret)
          if (vault.import(filePaths[0], cryptor)) {
            sync.initialize(vault, cryptor)
            return callback()
          }
          window.webContents.send('backup:password:fail')
        })
        window.webContents.send('backup:loaded')
      })
      .catch(() => {})
  })
}

export const onSetupDone = (vault, sync, callback) => {
  ipcMain.on('setup:done', (event, hashedSecret) => {
    const cryptor = new Cryptor(hashedSecret)
    vault.setup(cryptor)
    sync.initialize(vault, cryptor)
    callback()
  })
}
