import shortid from 'shortid'
import { Cryptor } from '@swiftyapp/cryptor'
import Storage, { vaultFile } from '../storage'

export default class Manager {
  constructor() {
    this.storage = new Storage()
    this.cryptr = null
    this.readData()
  }

  authenticate(password) {
    if (this.cryptr) {
      return this.validate(this.data, password)
    } else {
      return this.tryDecryptData(this.data, password)
    }
  }

  setup(password) {
    this.cryptr = new Cryptor(password)
    this.encryptedToken = this.cryptr.encrypt(password)
    if (!this.entries) this.entries = []
    this.writeData()
    this.readData()
  }

  save(data) {
    return data.id ? this.update(data) : this.create(data)
  }

  create(data) {
    const item = this.buildItem(data)
    this.entries.push(item)
    this.writeData()
    return item
  }

  update(data) {
    const index = this.entries.findIndex(item => item.id === data.id)
    data.updated_at = this.date()
    this.entries[index] = data
    this.writeData()
    return this.entries[index]
  }

  delete(id) {
    this.entries = this.entries.filter(item => item.id !== id)
    this.writeData()
  }

  isPristineStorage() {
    return this.data === ''
  }

  tryDecryptData(data, password) {
    this.cryptr = new Cryptor(password)
    try {
      const json = JSON.parse(this.cryptr.decrypt(data))
      if (this.cryptr.decrypt(json.token) !== password) return false
      this.encryptedToken = json.token
      this.entries = json.entries.map(item => {
        return JSON.parse(this.cryptr.decrypt(item))
      })
      return true
    } catch (e) {
      this.cryptr = null
      return false
    }
  }

  validate(data, password) {
    try {
      const json = JSON.parse(this.cryptr.decrypt(data))
      if (this.cryptr.decrypt(json.token) !== password) return false
      return true
    } catch (e) {
      return false
    }
  }

  readData() {
    this.data = this.storage.read(vaultFile())
  }

  writeData() {
    const entries = this.entries.map(item =>
      this.cryptr.encrypt(JSON.stringify(item))
    )
    const data = { token: this.encryptedToken, entries: entries }
    this.storage.write(vaultFile(), this.cryptr.encrypt(JSON.stringify(data)))
  }

  loadBackup(path) {
    this.backup = this.storage.read(path)
  }

  validateBackup(password) {
    if (this.tryDecryptData(this.backup, password)) {
      this.storage.write(vaultFile(), this.backup)
      return true
    } else {
      return false
    }
  }

  saveBackup(filepath) {
    return this.storage.export(vaultFile(), filepath)
  }

  date() {
    return new Date().toISOString()
  }

  buildItem(data) {
    const now = this.date()
    return {
      id: shortid.generate(),
      ...data,
      created_at: now,
      updated_at: now
    }
  }
  //
  // vaultFile() {
  //   if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
  //     return 'storage_default.swftx'
  //   }
  //   return `storage_${process.env.APP_ENV}.swftx`
  // }
}
