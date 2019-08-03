import { ipcMain } from 'electron'
import { Application } from 'nucleon'
import Window from '../window'
import Manager from '../manager'
import Tray from '../tray'
import { showSetup } from './setup'
import { showAuth } from './auth'

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
  }

  onWindowReady() {
    this.setupWindowEvents()
    this.subscribeForEvents()
    if (this.manager.isPristineStorage()) {
      return showSetup(this.window, this.manager)
    }
    return showAuth(this.window, this.manager)
  }

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
        showAuth(this.window, this.manager)
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
  }
}
