import shortid from 'shortid'
import Cryptr from 'cryptr'
import FileStorage from '../storage/file'

export default class Manager {
  constructor() {
    this.token = "3d56638738f6a4de1d724af6f88424dfc67976e6"
    this.provider = new FileStorage()
    this.cryptr = null
    this.data = this.provider.read()
    console.log(this.data)
  }

  authenticate(password) {
    this.cryptr = new Cryptr(password)
    if (this.isValidPassword()) {
      return true
    } else {
      this.cryptr = null
      return false
    }
  }

  setup(password) {
    this.cryptr = new Cryptr(password)
    this.data.token = this.cryptr.encrypt(this.token)
    this.provider.write(this.data)
  }

  get(id) {
    const data = this.data.items.find(item => (item.id === id))
    return JSON.parse(this.cryptr.decrypt(data))
  }

  getItems() {
    return this.data.items.map(item => {
      let data = {}
      data[item.key] = JSON.parse(this.cryptr.decrypt(item.value))
      return data
    })
  }

  set(data) {
    let item = {}
    item[shortid.generate()] = this.cryptr.encrypt(JSON.stringify(data))
    this.data.items.push(item)
    this.provider.write(this.data)
  }

  isTokenPresent() {
    return this.data.token !== null
  }

  isValidPassword() {
    return this.cryptr.decrypt(this.data.token) === this.token
  }
}
