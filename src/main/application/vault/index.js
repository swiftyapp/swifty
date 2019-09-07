import Storage from '../storage'

export default class Vault {
  constructor() {
    this.storage = new Storage(this.vaultFile())
  }

  authenticate(cryptor) {
    return this.isDecryptable(this.read(), cryptor)
  }

  setup(cryptor) {
    this.storage.write(cryptor.encrypt(JSON.stringify({ entries: [] })))
  }

  isPristine() {
    return this.read() === ''
  }

  isDecryptable(data, cryptor) {
    try {
      return !!JSON.parse(cryptor.decrypt(data))
    } catch (e) {
      console.log(e)
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

  vaultFile() {
    if (process.env.SPECTRON_STORAGE_PATH) {
      return process.env.SPECTRON_STORAGE_PATH
    }
    if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
      return 'storage_default.swftx'
    }
    return `storage_${process.env.APP_ENV}.swftx`
  }
}
