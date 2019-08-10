import { google } from 'googleapis'
import Client from './auth/client'
import Storage from '../../storage/file'
import {
  folderExists,
  fileExists,
  createFolder,
  createFile,
  updateFile
} from './files'

export default class GDrive {
  constructor() {
    this.storage = new Storage()
    this.client = new Client()
    this.folderName = 'Swifty'
    this.fileName = 'storage_default.sftx'
  }

  isConfigured() {
    return this.client.auth !== undefined
  }

  setup() {
    this.client.setupAuth()
    return this.client.authenticate()
  }

  disconnect() {
    return this.client.disconnect()
  }

  sync() {
    const { folderName, fileName } = this
    const drive = google.drive({ version: 'v3', auth: this.client.auth })

    return folderExists(folderName, drive).then(folderId => {
      if (!folderId) {
        return createFolder(folderName, drive).then(folderId => {
          return createFile(fileName, folderId, this.storage.read(), drive)
        })
      }
      return fileExists(fileName, folderId, drive).then(fileId => {
        if (!fileId) {
          return createFile(fileName, folderId, this.storage.read(), drive)
        }
        return updateFile(fileId, this.storage.read(), drive)
      })
    })
  }
}
