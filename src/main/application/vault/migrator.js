import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const btoa = data => {
  const buffer = Buffer.from(data, 'utf8')
  return buffer.toString('base64')
}

export const oldVaultFile = () => {
  if (process.env.SPECTRON_STORAGE_PATH) {
    return process.env.SPECTRON_STORAGE_PATH
  }
  if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
    return 'storage_default.swftx'
  }
  return `storage_${process.env.APP_ENV}.swftx`
}

export const newVaultFile = () => {
  if (process.env.SPECTRON_STORAGE_PATH) {
    return process.env.SPECTRON_STORAGE_PATH
  }
  if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
    return 'vault.swftx'
  }
  return `vault_${process.env.APP_ENV}.swftx`
}

export default class Migrator {
  shouldMigrate() {
    return this.oldFileExists() && this.newFileIsEmpty()
  }

  migrate(cryptor) {
    const string = fs.readFileSync(this.path(oldVaultFile())).toString('utf8')
    try {
      const data = JSON.parse(cryptor.decrypt(string))
      data.entries = data.entries.map(item => {
        const itemData = JSON.parse(cryptor.decrypt(item))
        switch (itemData.type) {
          case 'login':
            itemData.password = cryptor.encrypt(itemData.password)
            break
          case 'card':
            itemData.pin = cryptor.encrypt(itemData.pin)
            break
          case 'note':
            itemData.note = cryptor.encrypt(itemData.note)
            break
          default:
        }
        return itemData
      })
      const writeData = btoa(cryptor.encrypt(JSON.stringify(data)))
      fs.writeFileSync(this.path(newVaultFile()), writeData, { flag: 'w' })
      fs.unlinkSync(this.path(oldVaultFile()))
      return true
    } catch (e) {
      return false
    }
  }

  oldFileExists() {
    return fs.existsSync(this.path(oldVaultFile()))
  }

  newFileIsEmpty() {
    const path = this.path(newVaultFile())
    return !fs.existsSync(path) || fs.readFileSync(path).toString() === ''
  }

  path(file) {
    return path.join(app.getPath('appData'), app.getName(), file)
  }
}
