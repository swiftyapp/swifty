import path from 'path'
import electron from 'electron'
import trayIcon from 'iconTemplate@2x.png'
import lightTrayIcon from 'iconLightTemplate@2x.png'

export default class Tray extends electron.Tray {
  constructor(app) {
    const icon = process.platform === 'darwin' ? trayIcon : lightTrayIcon
    super(path.resolve(__dirname, icon))
    this.app = app
    this.setToolTip(CONFIG.name)
    this.on('click', () => this.app.window.show())
  }
}
