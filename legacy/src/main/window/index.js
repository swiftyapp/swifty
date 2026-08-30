import path from 'path'
import { BrowserWindow, shell } from 'electron'
import { getOptimalDimentions, getNewBounds } from 'helpers'

export default class MainWindow {
  constructor(options) {
    let settings = { ...options, ...getOptimalDimentions(options) }
    this.settings = settings
    this.window = new BrowserWindow(settings)
    this.window.loadFile(this.sourceFile())
    this.handleWindowEvents()
  }

  sourceFile() {
    return path.resolve(__dirname, '..', 'renderer', 'index.html')
  }

  handleWindowEvents() {
    this.window.once('ready-to-show', () => {
      if (this.settings.devTools) {
        this.window.webContents.openDevTools({ mode: 'detach' })
      }
      if (this.settings.onWindowReady) this.settings.onWindowReady()
      this.show()
    })

    this.window.on('activate-with-no-open-windows', () => {
      this.show()
    })

    this.window.on('close', e => {
      if (this.forceClose) return
      e.preventDefault()
      this.window.hide()
    })

    this.window.on('closed', () => {
      this.window.destroy()
    })
  }

  enlarge() {
    this.window.setMinimumSize(740, 400)
    this.resize({ width: 900, height: 700 }, true)
  }

  show() {
    this.window.show()
  }

  resize(options, animate) {
    const currentBounds = this.window.getBounds()
    const newBounds = getNewBounds(currentBounds, options)
    this.window.setBounds(newBounds, animate)
  }

  disableNavigation() {
    this.window.webContents.on('new-window', async (event, navigationUrl) => {
      event.preventDefault()
      await shell.openExternal(navigationUrl)
    })

    this.window.webContents.on('will-navigate', event => event.preventDefault())
  }

  on(event, callback) {
    this.window.on(event, callback)
  }

  send(event, data) {
    this.window.webContents.send(event, data)
  }
}
