import path from 'path'
import Auth from './auth'
import Drive from './drive'
import Storage from 'application/storage'
import { legacyVaultPath } from 'application/legacy_vault'

export const credentialsFile = () => {
  if (!process.env.APP_ENV || process.env.APP_ENV === 'production') {
    return 'gdrive.swftx'
  }
  return `gdrive_${process.env.APP_ENV}.swftx`
}

export default class GDrive {
  constructor(cryptor) {
    this.cryptor = cryptor
    this.folderName = 'Swifty'
    this.fileName = legacyVaultPath()
    this.credentials = new Storage(path.join('auth', credentialsFile()))
    this.auth = new Auth(
      () => this.readTokens(),
      tokens => this.writeTokens(tokens)
    )
    this.drive = new Drive(this.auth)
  }

  isConfigured() {
    return this.auth.isConfigured()
  }

  setup() {
    return this.auth.authenticate()
  }

  disconnect() {
    return this.auth.disconnect()
  }

  import() {
    return this.setup().then(() => this.pull())
  }

  pull() {
    return this.readRemoteVault()
  }

  push(data) {
    return this.writeRemoteVault(data)
  }

  async writeRemoteVault(data) {
    this.auth.loadCredentials()
    let folderId = await this.drive.folderExists(this.folderName)
    if (!folderId) return await this.createRemoteVault(data)

    let fileId = await this.drive.fileExists(this.fileName, folderId)
    if (!fileId) return await this.createRemoteVaultFile(folderId, data)

    return await this.drive.updateFile(fileId, data)
  }

  async readRemoteVault() {
    this.auth.loadCredentials()
    const folderId = await this.drive.folderExists(this.folderName)
    if (!folderId) throw Error('Swifty folder was not found on GDrive')

    const fileId = await this.drive.fileExists(this.fileName, folderId)
    if (!fileId) throw Error('Vault file was not found on GDrive')

    return await this.drive.readFile(fileId)
  }

  async createRemoteVault(data) {
    const folderId = await this.drive.createFolder(this.folderName)
    if (!folderId) throw Error('Failed to create Swifty folder on GDrive')

    return await this.createRemoteVaultFile(folderId, data)
  }

  async createRemoteVaultFile(folderId, data) {
    const fileId = await this.drive.createFile(this.fileName, folderId, data)
    if (!fileId) throw Error('Failed to create vault file on GDrive')

    return fileId
  }

  writeTokens(tokens) {
    return this.credentials.write(this.cryptor.encrypt(JSON.stringify(tokens)))
  }

  readTokens() {
    try {
      return JSON.parse(this.cryptor.decrypt(this.credentials.read()))
    } catch (e) {
      return null
    }
  }
}
