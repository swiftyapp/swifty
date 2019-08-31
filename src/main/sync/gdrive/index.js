import { google } from 'googleapis'
import Client from './auth/client'
import Storage, { vaultFile } from '../../storage'
import {
  folderExists,
  fileExists,
  createFolder,
  createFile,
  updateFile,
  readFile
} from './files'

export default class GDrive {
  constructor() {
    this.storage = new Storage()
    this.client = new Client()
    this.folderName = 'Swifty'
    this.fileName = vaultFile()
  }

  isConfigured() {
    return this.client.isConfigured()
  }

  setup() {
    return this.client.authenticate()
  }

  disconnect() {
    return this.client.disconnect()
  }

  import() {
    return this.setup().then(() => this.getFileContents())
  }

  read() {
    return this.storage.read(this.fileName)
  }

  getFileContents() {
    const drive = google.drive({ version: 'v3', auth: this.client.getAuth() })

    return new Promise((resolve, reject) => {
      folderExists(this.folderName, drive).then(folderId => {
        if (!folderId) reject()
        return fileExists(this.fileName, folderId, drive).then(fileId => {
          if (!fileId) reject()
          return readFile(fileId, drive).then(data => resolve(data))
        })
      })
    })
  }

  sync() {
    const drive = google.drive({ version: 'v3', auth: this.client.getAuth() })

    return folderExists(this.folderName, drive).then(folderId => {
      if (!folderId) {
        return createFolder(this.folderName, drive).then(folderId => {
          return createFile(this.fileName, folderId, this.read(), drive)
        })
      }
      return fileExists(this.fileName, folderId, drive).then(fileId => {
        if (!fileId) {
          return createFile(this.fileName, folderId, this.read(), drive)
        }
        return updateFile(fileId, this.read(), drive)
      })
    })
  }
}
