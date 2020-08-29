import path from 'path'
import electron, { Menu, shell } from 'electron'
import trayIcon from 'iconTemplate@2x.png'
import lightTrayIcon from 'iconLightTemplate@2x.png'

export default class Tray {
  constructor(app) {
    this.app = app
    this.tray = new electron.Tray(path.resolve(__dirname, this.icon()))
    this.tray.setToolTip(CONFIG.name)
    this.tray.setContextMenu(this.menu())
  }

  icon() {
    return process.platform === 'darwin' ? trayIcon : lightTrayIcon
  }

  menu() {
    return Menu.buildFromTemplate([
      { label: 'Open Swifty', click: () => this.app.window.show() },
      { label: 'Lock Screen', click: () => this.app.showAuth() },
      { type: 'separator' },
      {
        label: 'About',
        click: () => shell.openExternal('https://getswifty.pro')
      },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ])
  }
}
