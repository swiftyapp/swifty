import { readdirSync } from 'fs-extra'
import { join } from 'path'
import { Vault } from '@swiftyapp/vault'

const vaultsDirPath = () => {
  if (process.env.VAULTS_PATH) return join(process.env.VAULTS_PATH)

  return join(app.getPath('userData'), 'vaults')
}

export default class VaultManager {
  constructor() {
    this.vaults = []
    this.vaultFiles = this.existingVaults()
  }

  get vault() {
    return this.vaults[0]
  }

  vaultExists() {
    return !!this.vaultFiles[0]
  }

  authenticate(hashedSecret) {
    try {
      const vault = Vault.load(
        vaultsDirPath(),
        this.vaultFiles[0],
        hashedSecret
      )
      this.vaults.push(vault)
      return true
    } catch (e) {
      return false
    }
  }

  setup(hashedSecret) {
    try {
      const vault = Vault.initialize(vaultsDirPath(), 'Default', hashedSecret)
      this.vaults.push(vault)
      return true
    } catch (e) {
      return false
    }
  }

  read() {
    return this.vaults[0].serialize()
  }

  existingVaults() {
    try {
      return readdirSync(vaultsDirPath()).map(file =>
        file.replace('.swftx', '')
      )
    } catch (e) {
      return []
    }
  }
}
