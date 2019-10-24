import path from 'path'
import electron, { Menu, shell } from 'electron'
import trayIcon from 'iconTemplate@2x.png'
import lightTrayIcon from 'iconLightTemplate@2x.png'

export default class Tray extends electron.Tray {
  constructor(app) {
    const icon = process.platform === 'darwin' ? trayIcon : lightTrayIcon
    super(path.resolve(__dirname, icon))
    this.app = app
    this.setToolTip(CONFIG.name)
    this.setContextMenu(this.menu())
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
