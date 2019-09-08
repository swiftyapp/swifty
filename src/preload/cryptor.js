import crypto from 'crypto'
import { Cryptor } from '@swiftyapp/cryptor'

let cryptor

window.hashSecret = value => {
  return crypto
    .createHash('sha512')
    .update(value)
    .digest('base64')
}

window.setupCryptor = secret => {
  cryptor = new Cryptor(secret)
}

window.encrypt = value => {
  return cryptor.encrypt(value)
}

window.decrypt = value => {
  return cryptor.decrypt(value)
}
