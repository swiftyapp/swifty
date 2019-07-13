import shortid from 'shortid'
import Cryptr from 'cryptr'
import FileStorage from '../storage/file'

export default class Manager {
  constructor() {
    this.token = "3d56638738f6a4de1d724af6f88424dfc67976e6"
    this.provider = new FileStorage()
    this.data = this.provider.read()
    this.cryptr = null
  }

  authenticate(password) {
    this.cryptr = new Cryptr(password)
    if (this.isValidPassword()) {
      this.decryptEntries()
      return true
    } else {
      this.cryptr = null
      return false
    }
  }

  setup(password) {
    this.cryptr = new Cryptr(password)
    this.data = { token: this.cryptr.encrypt(this.token), entries: [] }
    this.provider.write(this.data)
  }

  getEntries() {
    return this.entries || []
  }

  save(data) {
    if (data.id) {
      this.update(data)
    } else {
      this.create(data)
    }
  }

  create(data) {
    const item = JSON.stringify(this.buildItem(data))
    this.data.entries.push(this.cryptr.encrypt(item))
    this.provider.write(this.data)
  }

  update(data) {

  }

  delete(id) {
    const entries = this.entries.filter(item => (item.id !== id))
    this.data.entries = this.data.entries.filter(item => (item.id !== id))
    this.writeData(this.data)
  }

  isTokenPresent() {
    return this.data.token !== null
  }

  isValidPassword() {
    return this.cryptr.decrypt(this.data.token) === this.token
  }

  decryptEntries() {
    this.entries = this.data.entries.map(item => {
      return JSON.parse(this.cryptr.decrypt(item))
    })
  }

  writeData() {
    const entries = this.data.entries.map(item => {
      return this.cryptr.encrypt(JSON.stringify(item))
    })
    const data = { ...this.data, entries: entries }
    console.log(data)
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
