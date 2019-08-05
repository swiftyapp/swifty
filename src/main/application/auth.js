import { ipcMain, systemPreferences } from 'electron'

const promptAuth = (window, manager) => {
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
    ipcMain.once('auth:done', (event, password) => {
      if (manager.authenticate(password)) {
        return resolve(password)
      } else {
        return reject(password)
      }
    })
  })
}

export const showAuth = (window, manager) => {
  promptAuth(window, manager)
    .then(() => {
      window.enlarge()
      window.webContents.send('auth:success', {
        entries: manager.entries,
        platform: process.platform
      })
    })
    .catch(() => {
      window.webContents.send('auth:fail')
      showAuth(window, manager)
    })
}
