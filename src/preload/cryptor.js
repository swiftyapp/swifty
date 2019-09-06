import crypto from 'crypto'
import { Cryptor } from '@swiftyapp/cryptor'

let cryptor

const encrypt = value => {
  return cryptor.encrypt(JSON.stringify(value))
}

const decrypt = value => {
  return JSON.parse(cryptor.decrypt(value))
}

window.hashSecret = value => {
  return crypto
    .createHash('sha512')
    .update(value)
    .digest('base64')
}

window.setupCryptor = secret => {
  cryptor = new Cryptor(secret)
}

window.decryptData = data => {
  return { entries: decrypt(data).entries.map(item => decrypt(item)) }
}

window.encryptData = data => {
  const vault = {
    entries: data.entries.map(item => encrypt(item))
  }
  return encrypt(vault)
}
