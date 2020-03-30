import { merge, groupBy } from 'lodash'
import { encrypt, decrypt } from 'application/helpers/encryption'
import GDrive from './gdrive'

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
          this._mergeAndPush(data)
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
    return this.provider.pull().then(data => this._mergeAndPush(data))
  }

  async _mergeAndPush(data) {
    if (this.vault.isDecryptable(data, this.cryptor)) {
      const merged = this._merge(this.vault.read(), data, this.cryptor)
      this.vault.write(merged)
      await this.provider.push(merged)
      return merged
    }
    throw Error('Remote vault file is invalid')
  }

  _merge(localData, remoteData, cryptor) {
    if (!remoteData) return localData
    return encrypt(
      {
        entries: this._mergeArrays(
          decrypt(localData, cryptor).entries,
          decrypt(remoteData, cryptor).entries
        ),
        updated_at: new Date().toISOString()
      },
      cryptor
    )
  }

  _mergeArrays(local, remote) {
    return Object.values(groupBy(local.concat(remote), item => item.id)).map(
      group => {
        if (group.length === 1) return group[0]
        return merge(group[0], group[1])
      }
    )
  }
}
