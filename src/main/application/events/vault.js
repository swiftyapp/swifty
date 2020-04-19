import { Cryptor } from 'main/application/cryptor'

const SENSITIVE_FIELDS = {
  login: ['password'],
  note: ['note'],
  card: ['pin']
}

const obscure = (data, cryptor) => {
  return prepareFields(data, property => cryptor.encrypt(property))
}

const expose = (data, cryptor) => {
  return prepareFields(data, property => cryptor.decrypt(property))
}

const prepareFields = (data, callback) => {
  if (!data) return
  const object = Object.assign({}, data)
  SENSITIVE_FIELDS[object.type].forEach(field => {
    object[field] = callback(object[field])
  })
  return object
}

export const onMasterPasswordChange = function (_, data) {
  const currentCryptor = new Cryptor(data.current)
  const newCryptor = new Cryptor(data.new)
  // currentCryptor.new = false
  // newCryptor.new = true
  const encrypted = this.vault.read()
  if (this.vault.isDecryptable(encrypted, currentCryptor)) {
    let decrypted = currentCryptor.decryptData(this.vault.read())
    decrypted.entries = decrypted.entries.map(entry => {
      return obscure(expose(entry, currentCryptor), newCryptor)
    })
    const newEncrypted = newCryptor.encryptData(decrypted)
    // Store newly encrypted credentials to vault
    this.vault.write(newEncrypted)
    // read tokens
    const tokens = this.sync.provider.readTokens()
    // update cryptor to new
    this.cryptor = newCryptor
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
    this.window.send('masterpassword:update:success')
  } else {
    this.window.send('masterpassword:update:failure', {
      message: 'Current password is invalid'
    })
  }
}
