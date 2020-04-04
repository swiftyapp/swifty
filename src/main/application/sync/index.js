import GDrive from './gdrive'
import { mergeData } from './base/merge'

export default class Sync {
  initialize(cryptor, vault) {
    this.cryptor = cryptor
    this.vault = vault
    this.provider = new GDrive(cryptor)
  }

  isConfigured() {
    return this.provider.isConfigured()
  }

  setup() {
    return this.provider.setup().then(() => {
      return this.provider
        .pull()
        .then(data => {
          this.mergeAndPush(data)
        })
        .catch(() => this.provider.push(this.vault.read()))
    })
  }

  disconnect() {
    return this.provider.disconnect()
  }

  import() {
    return this.provider.import()
  }

  perform() {
    return this.provider.pull().then(data => this.mergeAndPush(data))
  }

  async mergeAndPush(data) {
    if (this.vault.isDecryptable(data, this.cryptor)) {
      const merged = mergeData(this.vault.read(), data, this.cryptor)
      this.vault.write(merged)
      await this.provider.push(merged)
      return merged
    }
    throw Error('Remote vault file is invalid')
  }
}
