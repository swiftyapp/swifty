import { Application } from 'nucleon'
import Window from '../window'
import Storage from '../storage'
import { ipcMain } from 'electron'

export default class Swifty extends Application {
  components() {
    return { Window }
  }

  windowOptions() {
    return {
      name: this.settings.name,
      width: this.settings.width,
      height: this .settings.height
    }
  }

  onReady() {
    this.storage = new Storage({
      name: this.app.getName(),
      dataPath: this.app.getPath('appData')
    })
  }

  onWindowReady() {
    if (this.storage.data.key === null) {
      this.setupMasterPassword()
    } else {
      if (!this.masterPassword) {
        this.requireMasterPassword()
      }
    }
  }

  setupMasterPassword() {
    this.promptSetup().then(password => {
      this.storage.storeKey(password)
      this.launchApp()
    })
  }

  requireMasterPassword() {
    this.promptForMasterPassword().then(password => {
      this.masterPassword = password
      this.launchApp()
    }).catch(error => {
      this.promptInvalidMasterPassword()
      this.requireMasterPassword()
    })
  }

  promptSetup() {
    return new Promise((resolve, reject) => {
      this.window.webContents.send('prompt-setup')
      ipcMain.on('password-setup', (event, data) => {
        return resolve(data)
      })
    })
  }

  promptForMasterPassword() {
    return new Promise((resolve, reject) => {
      this.window.webContents.send('prompt-password')
      ipcMain.on('password-enter', (event, data) => {
        if (this.storage.isValidPassword(data))  {
          return resolve(data)
        } else {
          return reject(data)
        }
      })
    })
  }

  promptInvalidMasterPassword() {
    this.window.webContents.send('invalid-password')
  }

  launchApp() {
    this.window.webContents.send('launch-app')
  }
}
