import { ipcMain, systemPreferences } from 'electron'
import { Cryptor } from '@swiftyapp/cryptor'

export const promptAuth = (window, vault, sync) => {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      promptTouchIDAuth(window, sync, resolve, reject)
    }

    ipcMain.once('auth:start', (event, hashedSecret) => {
      const cryptor = new Cryptor(hashedSecret)
      if (vault.authenticate(cryptor)) {
        sync.initialize(vault, cryptor)
        return resolve()
      }
      reject()
    })
  })
}

const promptTouchIDAuth = (window, sync, resolve, reject) => {
  const touchID =
    sync.client && sync.client.cryptor && systemPreferences.canPromptTouchID()

  window.webContents.send('auth', touchID)
  ipcMain.once('auth:touchid', () => {
    systemPreferences
      .promptTouchID('Confirm your identity')
      .then(() => {
        return resolve()
      })
      .catch(err => {
        return reject(err)
      })
  })
}
