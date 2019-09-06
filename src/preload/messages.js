import { ipcRenderer } from 'electron'

window.onMessage = (message, callback) => {
  ipcRenderer.on(message, callback)
}

window.onOnce = (message, callback) => {
  ipcRenderer.once(message, callback)
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
window.sendSaveData = data => {
  ipcRenderer.send('data:save', data)
}

window.onDataSaved = callback => {
  ipcRenderer.once('data:saved', callback)
}

export default {}
