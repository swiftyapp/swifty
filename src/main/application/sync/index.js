import GDrive from './gdrive'
import { mergeData } from './base/merge'

const NO_INTERNET_CONNECTION = 'Swifty seems to be offline'
const FAILED_TO_FIND_REMOTE_VAULT = 'Failed to find remote vault file'
const FAILED_TO_CREATE_REMOTE_VAULT = 'Failed to create remote vault file'
const FAILED_TO_READ_REMOTE_VAULT = 'Failed to read remote vault file'
const FAILED_TO_WRITE_REMOTE_VAULT = 'Failed to write remote vault file'
const FAILED_TO_DECRYPT_REMOTE_VAULT = 'Failed to decrypt remote vault file'

const OFFLINE_CODE = 'ENOTFOUND'

export default class Sync {
  initialize(cryptor, vault) {
    this.cryptor = cryptor
    this.vault = vault
    this.provider = new GDrive(cryptor)
  }

  async perform() {
    if (!this.isConfigured()) {
      this.provider.setup()
    }

    if (!(await this.remoteVaultExists())) {
      await this.createRemoteVault()
      return this.pushRemoteVault()
    } else {
      const data = await this.pullRemoteVault()
      const merged = await this.mergeData(data)
      return this.pushRemoteVault(merged)
    }
  }

  isConfigured() {
    return this.provider.isConfigured()
  }

  disconnect() {
    return this.provider.disconnect()
  }

  import() {
    return this.provider.import()
  }

  // ***
  // Methods below are private and should not be used directly
  // ***

  remoteVaultExists() {
    return this.provider.fileExists().catch(error => {
      if (error.code === OFFLINE_CODE) throw Error(NO_INTERNET_CONNECTION)

      throw Error(FAILED_TO_FIND_REMOTE_VAULT)
    })
  }

  createRemoteVault() {
    return this.provider.createRemoteVault(this.vault.read()).catch(error => {
      if (error.code === OFFLINE_CODE) throw Error(NO_INTERNET_CONNECTION)

      throw Error(FAILED_TO_CREATE_REMOTE_VAULT)
    })
  }

  mergeData(data) {
    if (!this.vault.isDecryptable(data, this.cryptor))
      throw Error(FAILED_TO_DECRYPT_REMOTE_VAULT)

    const merged = mergeData(this.vault.read(), data, this.cryptor)
    this.vault.write(merged)
    return merged
  }

  pullRemoteVault() {
    return this.provider.pull().catch(error => {
      if (error.code === OFFLINE_CODE) throw Error(NO_INTERNET_CONNECTION)

      throw Error(FAILED_TO_READ_REMOTE_VAULT)
    })
  }

  pushRemoteVault() {
    return this.provider.push(this.vault.read()).catch(error => {
      if (error.code === OFFLINE_CODE) throw Error(NO_INTERNET_CONNECTION)

      throw Error(FAILED_TO_WRITE_REMOTE_VAULT)
    })
  }
}
