import path from 'path'
import { ipcMain, Tray } from 'electron'
import { Application } from 'nucleon'
import Window from '../window'
import Manager from '../manager'
import { showSetup } from './setup'
import { showAuth } from './auth'

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
    this.manager = new Manager()
    this.tray = new Tray(path.resolve(__dirname, '..', '..', 'images', 'tray', 'iconTemplate@2x.png'))
    this.tray.setToolTip(SETTINGS.name)
    this.tray.on('click', () => {
      this.window.show()
    })
  }

  onWindowReady() {
    this.subscribeForEvents()
    if (!this.manager.isTokenPresent()) {
      return showSetup(this.window, this.manager)
    }
    return showAuth(this.window, this.manager)
  }

  subscribeForEvents() {
    ipcMain.removeAllListeners()
    ipcMain.on('item:save', (event, data) => {
      const entry = this.manager.save(data)
      this.window.webContents.send('item:saved', { entry: entry, entries: this.manager.entries })
    })
    ipcMain.on('item:remove', (event, id) => {
      this.manager.delete(id)
      this.window.webContents.send('item:removed', this.manager.entries)
    })
  }
}
