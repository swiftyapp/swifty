import path from 'path'
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
    this.webContents.on('will-navigate', event => event.preventDefault())
  }
}
