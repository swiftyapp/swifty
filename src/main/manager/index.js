import shortid from 'shortid'
import Cryptr from 'cryptr'
import FileStorage from '../storage/file'

export default class Manager {
  constructor() {
    this.provider = new FileStorage()
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
    this.cryptr = new Cryptr(password)
    this.encryptedToken = this.cryptr.encrypt(password)
    this.entries = []
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
    this.cryptr = new Cryptr(password)
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
    this.data = this.provider.read()
  }

  writeData() {
    const entries = this.entries.map(item =>
      this.cryptr.encrypt(JSON.stringify(item))
    )
    const data = { token: this.encryptedToken, entries: entries }
    this.provider.write(this.cryptr.encrypt(JSON.stringify(data)))
  }

  loadBackup(path) {
    this.backup = this.provider.readFile(path)
  }

  validateBackup(password) {
    if (this.tryDecryptData(this.backup, password)) {
      this.provider.write(this.backup)
      return true
    } else {
      return false
    }
  }

  saveBackup(filepath) {
    return this.provider.copy(filepath)
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
}
