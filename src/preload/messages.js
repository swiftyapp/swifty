import { ipcRenderer } from 'electron'

window.onMessage = (message, callback) => {
  ipcRenderer.on(message, (event, data) => {
    callback(event, data)
  })
}

// Authentication and Setup
window.sendAuthStart = value => {
  ipcRenderer.send('auth:start', value)
}

window.onAuthFail = callback => {
  ipcRenderer.once('auth:fail', callback)
}

window.sendAuthTouchId = () => {
  ipcRenderer.send('auth:touchid')
}

window.sendSetupDone = password => {
  ipcRenderer.send('setup:done', password)
}

// Backup and Vault
window.sendBackupSelect = () => {
  ipcRenderer.send('backup:select')
}

window.sendBackupSave = filePath => {
  ipcRenderer.send('backup:save', filePath)
}

window.onBackupLoaded = callback => {
  ipcRenderer.once('backup:loaded', callback)
}

window.sendBackupPassword = password => {
  ipcRenderer.send('backup:password', password)
}

window.onBackupPasswordFail = callback => {
  ipcRenderer.on('backup:password:fail', callback)
}

window.sendVaultImport = () => {
  ipcRenderer.send('vault:import')
}

window.sendVaultConnect = () => {
  ipcRenderer.send('vault:sync:connect')
}

window.sendVaultDisconnect = () => {
  ipcRenderer.send('vault:sync:disconnect')
}
window.sendVaultSyncStart = () => {
  ipcRenderer.send('vault:sync:start')
}

// Entries management
window.sendItemSave = item => {
  ipcRenderer.send('item:save', item)
}

window.onItemSaved = callback => {
  ipcRenderer.once('item:saved', callback)
}

window.sendItemRemove = id => {
  ipcRenderer.send('item:remove', id)
}

window.onItemRemoved = callback => {
  ipcRenderer.once('item:removed', callback)
}

export default {}
