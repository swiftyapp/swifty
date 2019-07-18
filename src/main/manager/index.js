import shortid from 'shortid'
import Cryptr from 'cryptr'
import FileStorage from '../storage/file'

export default class Manager {
  constructor() {
    this.token = '3d56638738f6a4de1d724af6f88424dfc67976e6'
    this.provider = new FileStorage()
    this.encryptedToken = this.provider.read().token
    this.entries = []
    this.cryptr = null
  }

  authenticate(password) {
    this.cryptr = new Cryptr(password)
    if (this.isValidPassword()) {
      this.readEntries()
      return true
    } else {
      this.cryptr = null
      return false
    }
  }

  setup(password) {
    this.cryptr = new Cryptr(password)
    this.encryptedToken = this.cryptr.encrypt(this.token)
    this.entries = []
    this.writeData()
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
    this.entries[index] = data
    this.writeData()
    return this.entries[index]
  }

  delete(id) {
    this.entries = this.entries.filter(item => item.id !== id)
    this.writeData()
  }

  isTokenPresent() {
    return this.encryptedToken !== null
  }

  isValidPassword() {
    return this.cryptr.decrypt(this.encryptedToken) === this.token
  }

  readEntries() {
    this.entries = this.provider.read().entries.map(item => {
      return JSON.parse(this.cryptr.decrypt(item))
    })
  }

  writeData() {
    const entries = this.entries.map(item =>
      this.cryptr.encrypt(JSON.stringify(item))
    )
    this.provider.write({ token: this.encryptedToken, entries: entries })
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
