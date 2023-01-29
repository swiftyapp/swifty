import { Cryptor } from 'application/cryptor'
import { systemPreferences } from 'electron'

export const onAuthStart = function (_, hashedSecret) {
  this.cryptor = new Cryptor(hashedSecret)
  if (this.vault.authenticate(this.cryptor)) {
    this.sync.initialize(this.cryptor, this.vault)
    this.authSuccess()
    if (this.sync.isConfigured()) return this.pullVaultData()
    else return //this.getAudit()
  }
  this.cryptor = null
  return this.authFail()
}

export const onAuthTouchId = function () {
  systemPreferences
    .promptTouchID('Confirm your identity')
    .then(() => this.authSuccess())
    .catch(() => this.authFail())
}
