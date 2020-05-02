import { Cryptor } from 'application/cryptor'

export const onMasterPasswordChange = function (_, data) {
  const currentCryptor = new Cryptor(data.current)
  const newCryptor = new Cryptor(data.new)

  const encrypted = this.vault.read()

  if (this.vault.isDecryptable(encrypted, currentCryptor)) {
    let decrypted = currentCryptor.decryptData(this.vault.read())
    decrypted.entries = decrypted.entries.map(entry => {
      return newCryptor.obscure(currentCryptor.expose(entry))
    })
    const newEncrypted = newCryptor.encryptData(decrypted)
    this.vault.write(newEncrypted)

    const tokens = this.sync.provider.readTokens()
    this.cryptor = newCryptor

    if (this.sync.isConfigured()) {
      // Reinitialize sync
      this.sync.initialize(newCryptor, this.vault)
      // Write tokens
      this.sync.provider.writeTokens(tokens)
      // Reinitialize sync with newly written credentials
      this.sync.initialize(newCryptor, this.vault)
      this.window.send('vault:sync:started')
      this.sync.provider.push(newEncrypted).then(() => {
        this.window.send('vault:sync:stopped', { success: true })
      })
    }
    this.window.send('masterpassword:update:success')
  } else {
    this.window.send('masterpassword:update:failure', {
      message: 'Current password is invalid'
    })
  }
}
