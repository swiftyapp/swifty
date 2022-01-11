import { join } from 'path'
import { app } from 'electron'
import Storage from 'application/storage'

export const legacyVaultPath = () => {
  if (process.env.LEGACY_VAULT_PATH) return process.env.LEGACY_VAULT_PATH

  return join(app.getPath('userData'), 'vault.swftx')
}

export default class LegacyVault {
  constructor() {
    this.storage = new Storage(legacyVaultPath())
  }

  authenticate(cryptor) {
    return this.isDecryptable(this.read(), cryptor)
  }

  setup(cryptor) {
    return this.storage.write(cryptor.encryptData({ entries: [] }))
  }

  isPristine() {
    return this.read() === ''
  }

  isDecryptable(data, cryptor) {
    try {
      return !!cryptor.decryptData(data)
    } catch (e) {
      return false
    }
  }

  write(data) {
    return this.storage.write(data)
  }

  read() {
    return this.storage.read()
  }

  import(path, cryptor) {
    const data = this.storage.import(path)
    if (this.isDecryptable(data, cryptor)) {
      return this.storage.write(data)
    }
    return false
  }

  export(filepath) {
    return this.storage.export(filepath)
  }
}
