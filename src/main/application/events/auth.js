import { Cryptor } from '@swiftyapp/cryptor'
import { ipcMain, systemPreferences } from 'electron'

export const onAuthStart = function() {
  ipcMain.once('auth:start', (event, hashedSecret) => {
    this.cryptor = new Cryptor(hashedSecret)
    if (this.vault.authenticate(this.cryptor)) {
      this.sync.initialize(this.vault, this.cryptor)
      return this.authSuccess()
    }
    return this.authFail()
  })
}

export const onAuthTouchId = function() {
  ipcMain.once('auth:touchid', () => {
    systemPreferences
      .promptTouchID('Confirm your identity')
      .then(() => this.authSuccess())
      .catch(() => this.authFail())
  })
}
