import { ipcMain, systemPreferences } from 'electron'

export const promptAuth = (window, manager) => {
  return new Promise((resolve, reject) => {
    const touchID =
      manager.cryptr !== null && systemPreferences.canPromptTouchID()

    window.webContents.send('auth', touchID)
    ipcMain.once('auth:touchid', () => {
      systemPreferences
        .promptTouchID('Confirm your identity')
        .then(() => {
          return resolve()
        })
        .catch(err => {
          return reject(err)
        })
    })
    ipcMain.once('auth:start', (event, password) => {
      if (manager.authenticate(password)) {
        return resolve(password)
      } else {
        return reject(password)
      }
    })
  })
}
