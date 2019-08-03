import path from 'path'
import electron from 'electron'
import trayIcon from 'iconTemplate@2x.png'

export default class Tray extends electron.Tray {
  constructor(app) {
    super(path.resolve(__dirname, trayIcon))
    this.app = app
    this.setToolTip(CONFIG.name)
    this.on('click', () => this.app.window.show())
  }
}
