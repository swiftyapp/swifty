import { ipcMain } from 'electron'

const promptAuth = (window, manager) => {
  return new Promise((resolve, reject) => {
    window.webContents.send('auth')
    ipcMain.on('auth:done', (event, password) => {
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
      window.webContents.send('auth:success', manager.entries)
    })
    .catch(() => {
      window.webContents.send('auth:fail')
      showAuth(window, manager)
    })
}
