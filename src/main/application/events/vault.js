import { Cryptor } from '@swiftyapp/cryptor'
import { encrypt, decrypt } from 'application/helpers/encryption'

const SENSITIVE_FIELDS = {
  login: ['password'],
  note: ['note'],
  card: ['pin']
}

export const obscure = (data, cryptor) => {
  return prepareFields(data, property => cryptor.encrypt(property))
}

export const expose = (data, cryptor) => {
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
  const encrypted = this.vault.read()
  if (this.vault.isDecryptable(encrypted, currentCryptor)) {
    let decrypted = decrypt(this.vault.read(), currentCryptor)
    decrypted.entries.forEach(entry => {
      expose(entry, currentCryptor)
      obscure(entry, newCryptor)
    })
    const newEncrypted = encrypt(decrypted, newCryptor)
    // this.vault.write(newEncrypted)
    // this.cryptor = newCryptor
    this.window.send('masterpassword:update:success')
  } else {
    this.window.send('masterpassword:update:failure', {
      message: 'Current password is invalid'
    })
  }
}
