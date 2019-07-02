import fs from 'fs'
import path from 'path'
import shortid from 'shortid'
import Cryptr from 'cryptr'

export default class Storage {
  constructor(options) {
    this.token = "3d56638738f6a4de1d724af6f88424dfc67976e6"
    this.filePath = this.buildPath(options)
    this.readStorageFile()
  }

  encrypt(password, string) {
    const cryptr = new Cryptr(password)
    return cryptr.encrypt(string)
  }

  decrypt(password, string) {
    const cryptr = new Cryptr(password)
    return cryptr.decrypt(string)
  }

  get(id) {
    return this.data.items.find(item => {
      return item.id === id
    })
  }

  save(data) {
    this.data.items[shortid.generate()] = data
    this.writeStorageFile(this.data)
  }

  isValidPassword(password) {
    return this.decrypt(password, this.data.key) === this.token
  }

  storeKey(password) {
    this.data.key = this.encrypt(password, this.token)
    this.writeStorageFile(this.data)
  }

  createStorageFile() {
    this.writeStorageFile({ key: null, items: [] })
  }

  readStorageFile(options) {
    if (!fs.existsSync(this.filePath)) {
      this.createStorageFile()
    }
    const data = fs.readFileSync(this.filePath)
    this.data = JSON.parse(data)
    console.log(this.data)
  }

  writeStorageFile(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data), { flag: 'w' })
    } catch(error) {
      console.log(error)
    }
  }

  buildPath(options) {
    const { dataPath, name } = options
    return path.join(dataPath, name, 'storage_default.swftx')
  }
}
