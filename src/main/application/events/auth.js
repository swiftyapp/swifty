import { Cryptor } from '@swiftyapp/cryptor'
import { ipcMain, systemPreferences } from 'electron'

export const onAuthStart = (vault, sync, resolve, reject) => {
  ipcMain.once('auth:start', (event, hashedSecret) => {
    const cryptor = new Cryptor(hashedSecret)
    if (vault.authenticate(cryptor)) {
      sync.initialize(vault, cryptor)
      return resolve()
    }
    reject()
  })
}

export const onAuthTouchId = (resolve, reject) => {
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
