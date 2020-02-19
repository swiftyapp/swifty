import { Cryptor } from '@swiftyapp/cryptor'
import { ipcMain, systemPreferences } from 'electron'

export const onAuthStart = function() {
  ipcMain.once('auth:start', (_, hashedSecret) => {
    this.cryptor = new Cryptor(hashedSecret)
    if (this.vault.authenticate(this.cryptor)) {
      this.sync.initialize(this.cryptor)
      this.authSuccess()
      if (this.sync.isConfigured())
        return this.pullVaultData().then(data => {
          if (this.vault.isDecryptable(data, this.cryptor))
            this.vault.write(data)
          this.getAudit()
        })
      else return this.getAudit()
    }
    this.cryptor = null
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
