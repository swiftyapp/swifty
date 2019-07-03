import { Application } from 'nucleon'
import Window from '../window'
import Manager from '../manager'
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
    this.manager = new Manager()
  }

  onWindowReady() {
    if (!this.manager.isTokenPresent()) {
      return this.setupMasterPassword()
    }
    return this.requireMasterPassword()
  }

  setupMasterPassword() {
    this.promptSetup().then(password => {
      this.manager.setup(password)
      this.launchApp()
    })
  }

  requireMasterPassword() {
    this.promptForMasterPassword().then(() => {
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
      ipcMain.on('password-enter', (event, password) => {
        if (this.manager.authenticate(password))  {
          return resolve(password)
        } else {
          return reject(password)
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
