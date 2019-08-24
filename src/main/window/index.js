import path from 'path'
import { shell } from 'electron'
import { Window } from 'nucleon'

export default class MainWindow extends Window {
  sourceFile() {
    return path.resolve(__dirname, '..', 'renderer', 'index.html')
  }

  enlarge() {
    this.setMinimumSize(740, 400)
    this.resize({ width: 900, height: 700 }, true)
  }

  disableNavigation() {
    this.webContents.on('new-window', async (event, navigationUrl) => {
      event.preventDefault()
      await shell.openExternal(navigationUrl)
    })

    this.webContents.on('will-navigate', event => event.preventDefault())
  }
}
