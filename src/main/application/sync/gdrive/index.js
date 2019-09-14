import { google } from 'googleapis'
import Client from './auth/client'
import { vaultFile } from '../../vault'
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
    this.folderName = 'Swifty'
    this.fileName = vaultFile()
  }

  initialize(vault, cryptor) {
    this.vault = vault
    this.client = new Client(cryptor)
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
    return this.vault.read()
  }

  pull() {
    return new Promise(resolve => {
      if (!this.isConfigured()) return resolve(false)
      this.getFileContents().then(data => {
        if (!this.vault.isDecryptable(data, this.client.cryptor))
          return resolve(false)
        this.vault.write(data)
        return resolve(true)
      })
    })
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
