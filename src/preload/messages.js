import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('MessagesAPI', {
  onMessage: (message, callback) => {
    ipcRenderer.on(message, callback)
  },
  onOnce: (message, callback) => {
    ipcRenderer.once(message, callback)
  },
  sendAuthStart: value => {
    ipcRenderer.send('auth:start', value)
  },
  onAuthFail: callback => {
    ipcRenderer.once('auth:fail', callback)
  },
  sendAuthTouchId: () => {
    ipcRenderer.send('auth:touchid')
  },
  sendSetupDone: password => {
    ipcRenderer.send('setup:done', password)
  },
  sendBackupSelect: () => {
    ipcRenderer.send('backup:select')
  },
  sendBackupSave: filePath => {
    ipcRenderer.send('backup:save', filePath)
  },
  onBackupLoaded: callback => {
    ipcRenderer.once('backup:loaded', callback)
  },
  sendBackupPassword: password => {
    ipcRenderer.send('backup:password', password)
  },
  onBackupPasswordFail: callback => {
    ipcRenderer.on('backup:password:fail', callback)
  },
  sendVaultImport: () => {
    ipcRenderer.send('vault:sync:import')
  },
  sendVaultConnect: () => {
    ipcRenderer.send('vault:sync:connect')
  },
  sendVaultDisconnect: () => {
    ipcRenderer.send('vault:sync:disconnect')
  },
  sendVaultSyncStart: () => {
    ipcRenderer.send('vault:sync:start')
  },

  sendSaveData: data => {
    ipcRenderer.send('data:save', data)
  },
  onDataSaved: callback => {
    ipcRenderer.once('data:saved', callback)
  },
  updateMasterPassword: data => {
    return new Promise((resolve, reject) => {
      ipcRenderer.send('masterpassword:update', data)
      ipcRenderer.once('masterpassword:update:success', resolve)
      ipcRenderer.once('masterpassword:update:failure', (_, errors) => {
        reject(errors)
      })
    })
  }
})

export default {}
