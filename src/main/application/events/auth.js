import { Cryptor } from '@swiftyapp/cryptor'
import { ipcMain, systemPreferences } from 'electron'
import Auditor from '../auditor'

export const onAuthStart = function() {
  const getAudit = () => {
    const auditor = new Auditor(this.vault.read(), this.cryptor)
    auditor.getAudit().then(data => {
      this.window.send('audit:done', { data })
    })
  }

  ipcMain.once('auth:start', (event, hashedSecret) => {
    this.cryptor = new Cryptor(hashedSecret)
    if (this.vault.authenticate(this.cryptor)) {
      this.sync.initialize(this.vault, this.cryptor)
      this.authSuccess()
      if (this.sync.isConfigured())
        return this.pullVaultData().then(() => getAudit())
      else return getAudit()
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
