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
        this.shouldShowAuth = true
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

    ipcMain.on('backup:sync:start', () => {
      if (this.gdrive.isConfigured()) {
        this.gdrive.sync()
      }
    })

    ipcMain.on('backup:sync:setup', () => {
      if (!this.gdrive.isConfigured()) {
        this.gdrive.setup()
      }
    })
  }

  /**
   * Authentication and Setup
   */
  showAuth() {
    promptAuth(this.window, this.manager)
      .then(() => this.authSuccess())
      .catch(() => this.authFail())
  }

  showSetup() {
    promptSetup(this.window, this.manager).then(password => {
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
