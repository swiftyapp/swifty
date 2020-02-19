import Client from './auth/client'
import Drive from './drive'
import { vaultFile } from 'application/vault'

export default class GDrive {
  constructor() {
    this.folderName = 'Swifty'
    this.fileName = vaultFile()
  }

  initialize(cryptor) {
    this.client = new Client(cryptor)
    this.drive = new Drive(this.client.getAuth())
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
    return this.setup().then(() => this.pull())
  }

  async pull() {
    const folderId = await this.drive.folderExists(this.folderName)
    if (!folderId) throw Error('folder_not_found')

    const fileId = await this.drive.fileExists(this.fileName, folderId)
    if (!fileId) throw Error('file_not_found')

    return await this.drive.readFile(fileId)
  }

  async push(data) {
    let folderId = await this.drive.folderExists(this.folderName)
    if (!folderId) return await this.createRemoteVault(data)

    let fileId = await this.drive.fileExists(this.fileName, folderId)
    if (!fileId) return await this.createRemoteVaultFile(folderId, data)

    return await this.drive.updateFile(fileId, data)
  }

  async createRemoteVault(data) {
    const folderId = await this.drive.createFolder(this.folderName)
    if (!folderId) throw Error('folder_creation_error')

    return await this.createRemoteVaultFile(folderId, data)
  }

  async createRemoteVaultFile(folderId, data) {
    const fileId = await this.drive.createFile(this.fileName, folderId, data)
    if (!fileId) throw Error('file_creation_error')

    return fileId
  }
}
