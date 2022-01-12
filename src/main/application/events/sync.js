export const onVaultSyncImport = function () {
  this.sync.import().then(data => {
    this.vaultManager.write(data)
    this.vaultManager.read()
    this.sync.initialize(null)
    return this.showAuth()
  })
}

export const onVaultSyncConnect = function () {
  if (!this.sync.isConfigured()) {
    this.sync.setup().then(() => {
      this.window.send('vault:sync:connected')
      //return this.pullVaultData()
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
}
