import { contextBridge } from 'electron'
import crypto from 'crypto'
import { Cryptor } from 'application/cryptor'

let cryptor

contextBridge.exposeInMainWorld('CryptorAPI', {
  hashSecret: value =>
    crypto.createHash('sha512').update(value).digest('base64'),
  setupCryptor: secret => {
    cryptor = new Cryptor(secret)
  },
  decryptData: data => cryptor.decryptData(data),
  encryptData: data => cryptor.encryptData(data),
  encrypt: value => cryptor.encrypt(value),
  decrypt: value => cryptor.decrypt(value),
  obscure: value => cryptor.obscure(value),
  expose: value => cryptor.expose(value)
})
