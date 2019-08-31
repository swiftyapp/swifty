import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const appDir = () => {
  return path.join(app.getPath('appData'), app.getName())
}

const filepath = file => {
  if (process.env.SPECTRON_STORAGE_PATH) {
    return process.env.SPECTRON_STORAGE_PATH
  }
  return !path.isAbsolute(file) ? path.join(appDir(), file) : file
}

export const vaultFile = () => {
  if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
    return 'storage_default.swftx'
  }
  return `storage_${process.env.APP_ENV}.swftx`
}

export default class Storage {
  read(filename) {
    if (!fs.existsSync(filepath(filename))) this.write(filename, '')
    return fs.readFileSync(filepath(filename)).toString('utf8')
  }

  write(filename, data) {
    try {
      fs.writeFileSync(filepath(filename), data, { flag: 'w' })
      return true
    } catch (error) {
      return false
    }
  }

  export(filename, path) {
    const dest = !path.match(/\.swftx$/) ? `${path}.swftx` : path
    return fs.copyFileSync(filepath(filename), dest)
  }
}
