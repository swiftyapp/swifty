import crypto from 'crypto'
import { Cryptor } from 'application/cryptor'

let cryptor

window.hashSecret = value => {
  return crypto.createHash('sha512').update(value).digest('base64')
}

window.setupCryptor = secret => {
  cryptor = new Cryptor(secret)
}

window.decryptData = data => cryptor.decryptData(data)
window.encryptData = data => cryptor.encryptData(data)
window.encrypt = value => cryptor.encrypt(value)
window.decrypt = value => cryptor.decrypt(value)
window.obscure = value => cryptor.obscure(value)
window.expose = value => cryptor.expose(value)
