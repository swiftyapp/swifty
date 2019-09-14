import { ipcMain } from 'electron'

export const onVaultSyncImport = (vault, sync, callback) => {
  ipcMain.on('vault:sync:import', () => {
    sync.import().then(data => {
      vault.write(data)
      vault.read()
      sync.initialize(vault, null)
      callback()
    })
  })
}

export const onVaultSyncConnect = (sync, window, callback) => {
  ipcMain.on('vault:sync:connect', () => {
    if (!sync.isConfigured()) {
      sync.setup().then(() => {
        window.send('vault:sync:connected')
        callback()
      })
    }
  })
}

export const onVaultSyncDisconnect = (sync, window) => {
  ipcMain.on('vault:sync:disconnect', () => {
    if (sync.isConfigured()) {
      sync.disconnect()
      window.send('vault:sync:disconnected')
    }
  })
}

export const onVaultSyncStart = (sync, window) => {
  ipcMain.on('vault:sync:start', () => {
    if (sync.isConfigured()) {
      window.send('vault:sync:started')
      sync
        .sync()
        .then(() => {
          window.send('vault:sync:stopped', {
            success: true
          })
        })
        .catch(error => {
          window.send('vault:sync:stopped', {
            success: false
          })
          /* eslint-disable-next-line no-console */
          console.log(error)
        })
    }
  })
}
