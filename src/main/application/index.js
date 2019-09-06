import path from 'path'
import { ipcMain, app } from 'electron'
import { Application } from 'nucleon'
import Window from '../window'
import Tray from '../tray'
import GDrive from './sync/gdrive'
import Vault from './vault'
import { promptSetup } from './prompt/setup'
import { promptAuth } from './prompt/auth'

const INACTIVE_TIMEOUT = 60000

export default class Swifty extends Application {
  components() {
    return { Window }
  }

  windowOptions() {
    return {
      titleBarStyle: 'hiddenInset',
      name: this.settings.name,
      width: this.settings.width,
      height: this.settings.height,
      devTools: this.settings.devTools,
      webPreferences: {
        preload: path.join(app.getAppPath(), 'preload', 'index.js')
      }
    }
  }

  onReady() {
    this.shouldShowAuth = false
    this.vault = new Vault()
    this.tray = new Tray(this)
    this.sync = new GDrive()
  }

  onWindowReady() {
    this.window.setMenu(null)
    this.window.disableNavigation()
    this.setupWindowEvents()
    this.subscribeForEvents()
    if (this.vault.isPristine()) {
      return this.showSetup(this.window, this.vault)
    }
    return this.showAuth(this.window, this.vault)
  }

  /**
   * Application Events
   */
  setupWindowEvents() {
    this.window.on('close', () => {
      this.shouldShowAuth = true
      clearTimeout(this.inactiveTimeout)
    })
    this.window.on('hide', () => {
      this.inactiveTimeout = setTimeout(() => {
        if (this.vault.cryptor) this.shouldShowAuth = true
      }, INACTIVE_TIMEOUT)
    })
    this.window.on('show', () => {
      clearTimeout(this.inactiveTimeout)
      if (this.shouldShowAuth) {
        this.showAuth(this.window, this.vault)
        this.shouldShowAuth = false
      }
    })
  }

  subscribeForEvents() {
    ipcMain.removeAllListeners()
    ipcMain.on('data:save', (event, data) => {
      this.vault.write(data)
      this.window.webContents.send('data:saved', {
        data: this.vault.read()
      })
    })
    ipcMain.on('backup:save', (event, filepath) => {
      this.vault.export(filepath)
    })

    ipcMain.on('vault:import', () => {
      this.sync.import().then(data => {
        this.vault.provider.write(data)
        this.vault.read()
        return this.showAuth(this.window, this.vault)
      })
    })

    ipcMain.on('vault:sync:start', () => {
      if (this.sync.isConfigured()) {
        this.window.webContents.send('vault:sync:started')
        this.sync
          .sync()
          .then(() => {
            this.window.webContents.send('vault:sync:stopped', {
              success: true
            })
          })
          .catch(error => {
            this.window.webContents.send('vault:sync:stopped', {
              success: false
            })
            /* eslint-disable-next-line no-console */
            console.log(error)
          })
      }
    })

    ipcMain.on('vault:sync:connect', () => {
      if (!this.sync.isConfigured()) {
        this.sync.setup().then(() => {
          this.window.webContents.send('vault:sync:connected')
        })
      }
    })

    ipcMain.on('vault:sync:disconnect', () => {
      if (this.sync.isConfigured()) {
        this.sync.disconnect()
        this.window.webContents.send('vault:sync:disconnected')
      }
    })
  }

  /**
   * Authentication and Setup
   */
  showAuth() {
    return promptAuth(this.window, this.vault, this.sync)
      .then(() => this.authSuccess())
      .catch(() => this.authFail())
  }

  showSetup() {
    return promptSetup(this.window, this.vault, this.sync).then(() =>
      this.authSuccess()
    )
  }

  authSuccess() {
    this.window.enlarge()
    this.window.webContents.send('auth:success', {
      sync: this.sync.isConfigured(),
      data: this.vault.read(),
      platform: process.platform
    })
  }

  authFail() {
    this.window.webContents.send('auth:fail')
    this.showAuth()
  }
}
