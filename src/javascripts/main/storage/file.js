import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export default class FileStorage {
  constructor() {
    this.filePath = this.buildPath()
  }

  write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data), { flag: 'w' })
    } catch(error) {
      console.log(error)
    }
  }

  read() {
    if (!fs.existsSync(this.filePath)) {
      this.create()
    }
    const data = JSON.parse(fs.readFileSync(this.filePath))
    return data
  }

  create() {
    this.write({ token: null, entries: [] })
  }

  buildPath() {
    return path.join(
      app.getPath('appData'), app.getName(), 'storage_default.swftx'
    )
  }
}
