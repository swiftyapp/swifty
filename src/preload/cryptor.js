import { contextBridge } from 'electron'
import { Cryptor, hashSecret } from 'application/cryptor'

let cryptor

contextBridge.exposeInMainWorld('CryptorAPI', {
  hashSecret: hashSecret,
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
