import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export default class Storage {
  constructor() {
    if (!fs.existsSync(this.dirPath())) {
      fs.mkdirSync(this.dirPath())
    }
  }

  read(name) {
    if (fs.existsSync(this.filePath(name))) {
      return JSON.parse(fs.readFileSync(this.filePath(name)).toString('utf8'))
    }
    return null
  }

  write(name, data) {
    try {
      fs.writeFileSync(this.filePath(name), JSON.stringify(data), { flag: 'w' })
    } catch (error) {
      /* eslint-disable-next-line no-console */
      console.log(error)
    }
  }

  dirPath() {
    return path.join(app.getPath('appData'), app.getName(), 'credentials')
  }

  filePath(name) {
    return path.join(this.dirPath(), `${name}.json`)
  }
}
