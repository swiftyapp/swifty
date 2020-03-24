import { ipcMain } from 'electron'

export const onDataSave = function () {
  ipcMain.on('data:save', (event, data) => {
    this.vault.write(data)
    this.window.send('data:saved', { data: this.vault.read() })
    return this.getAudit()
  })
}

export const onBackupSave = function () {
  ipcMain.on('backup:save', (event, filepath) => {
    this.vault.export(filepath)
  })
}

export const onVaultSyncImport = function () {
  ipcMain.on('vault:sync:import', () => {
    this.sync.import().then(data => {
      this.vault.write(data)
      this.vault.read()
      this.sync.initialize(null)
      return this.showAuth()
    })
  })
}

export const onVaultSyncConnect = function () {
  ipcMain.on('vault:sync:connect', () => {
    if (!this.sync.isConfigured()) {
      this.sync.setup().then(() => {
        this.window.send('vault:sync:connected')
        //return this.pullVaultData()
      })
    }
  })
}

export const onVaultSyncDisconnect = function () {
  ipcMain.on('vault:sync:disconnect', () => {
    if (this.sync.isConfigured()) {
      this.sync.disconnect()
      this.window.send('vault:sync:disconnected')
    }
  })
}

export const onVaultSyncStart = function () {
  ipcMain.on('vault:sync:start', () => {
    if (this.sync.isConfigured()) {
      this.window.send('vault:sync:started')
      this.sync
        .perform()
        .then(() => {
          this.window.send('vault:sync:stopped', {
            success: true
          })
        })
        .catch(error => {
          this.window.send('vault:sync:stopped', {
            success: false
          })
          /* eslint-disable-next-line no-console */
          console.log(error)
        })
    }
  })
}

export default {
  onDataSave,
  onBackupSave,
  onVaultSyncImport,
  onVaultSyncConnect,
  onVaultSyncDisconnect,
  onVaultSyncStart
}
