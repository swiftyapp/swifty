import { trackVaultEvent } from 'analytics'
import { dialog } from 'electron'

export const onDataSave = function (_, data) {
  this.vault.write(data)
  this.window.send('data:saved', { data: this.vault.read() })
  trackVaultEvent('Saved')
  return this.getAudit()
}

export const onBackupSave = function () {
  dialog
    .showSaveDialog({ defaultPath: 'vault.swftx' })
    .then(({ canceled, filePath }) => {
      if (!canceled) this.vault.export(filePath)
    })
}

export const onVaultSyncImport = function () {
  this.sync.import().then(data => {
    this.vault.write(data)
    this.vault.read()
    this.sync.initialize(null)
    return this.showAuth()
  })
}

export const onVaultSyncConnect = function () {
  if (!this.sync.isConfigured()) {
    this.sync.perform().then(() => {
      this.window.send('vault:sync:connected')
    })
  }
}

export const onVaultSyncDisconnect = function () {
  if (this.sync.isConfigured()) {
    this.sync.disconnect()
    this.window.send('vault:sync:disconnected')
  }
}

export const onVaultSyncStart = function () {
  if (this.sync.isConfigured()) {
    this.window.send('vault:sync:started')
    this.sync
      .perform()
      .then(() => {
        this.window.send('vault:sync:stopped', { success: true })
      })
      .catch(error => {
        this.window.send('vault:sync:stopped', {
          success: false,
          error
        })
      })
  }
}

export default {
  onDataSave,
  onBackupSave,
  onVaultSyncImport,
  onVaultSyncConnect,
  onVaultSyncDisconnect,
  onVaultSyncStart
}
