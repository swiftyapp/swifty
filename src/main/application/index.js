import { ipcMain } from 'electron'
import { Application } from 'nucleon'
import Window from '../window'
import Manager from '../manager'
import Tray from '../tray'
import GDrive from '../sync/gdrive'
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
      devTools: this.settings.devTools
    }
  }

  onReady() {
    this.shouldShowAuth = false
    this.manager = new Manager()
    this.tray = new Tray(this)
    this.gdrive = new GDrive()
  }

  onWindowReady() {
    this.window.setMenu(null)
    this.setupWindowEvents()
    this.subscribeForEvents()
    if (this.manager.isPristineStorage()) {
      return this.showSetup(this.window, this.manager)
    }
    return this.showAuth(this.window, this.manager)
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
        if (this.manager.cryptr) this.shouldShowAuth = true
      }, INACTIVE_TIMEOUT)
    })
    this.window.on('show', () => {
      clearTimeout(this.inactiveTimeout)
      if (this.shouldShowAuth) {
        this.showAuth(this.window, this.manager)
        this.shouldShowAuth = false
      }
    })
  }

  subscribeForEvents() {
    ipcMain.removeAllListeners()
    ipcMain.on('item:save', (event, data) => {
      const entry = this.manager.save(data)
      this.window.webContents.send('item:saved', {
        entry: entry,
        entries: this.manager.entries
      })
    })
    ipcMain.on('item:remove', (event, id) => {
      this.manager.delete(id)
      this.window.webContents.send('item:removed', this.manager.entries)
    })
    ipcMain.on('backup:save', (event, filepath) => {
      this.manager.saveBackup(filepath)
    })

    ipcMain.on('vault:import', () => {
      this.gdrive.import().then(data => {
        this.manager.provider.write(data)
        this.manager.readData()
        return this.showAuth(this.window, this.manager)
      })
    })

    ipcMain.on('vault:sync:start', () => {
      if (this.gdrive.isConfigured()) {
        this.window.webContents.send('vault:sync:started')
        this.gdrive
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
      if (!this.gdrive.isConfigured()) {
        this.gdrive.setup().then(() => {
          this.window.webContents.send('vault:sync:connected')
        })
      }
    })

    ipcMain.on('vault:sync:disconnect', () => {
      if (this.gdrive.isConfigured()) {
        this.gdrive.disconnect()
        this.window.webContents.send('vault:sync:disconnected')
      }
    })
  }

  /**
   * Authentication and Setup
   */
  showAuth() {
    return promptAuth(this.window, this.manager)
      .then(() => this.authSuccess())
      .catch(() => this.authFail())
  }

  showSetup() {
    return promptSetup(this.window, this.manager).then(password => {
      this.manager.setup(password)
      this.authSuccess()
    })
  }

  authSuccess() {
    this.window.enlarge()
    this.window.webContents.send('auth:success', {
      entries: this.manager.entries,
      platform: process.platform,
      sync: this.gdrive.isConfigured()
    })
  }

  authFail() {
    this.window.webContents.send('auth:fail')
    this.showAuth()
  }
}
