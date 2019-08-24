import { remote } from 'electron'

window.showSaveDialog = callback => {
  remote.dialog.showSaveDialog().then(callback)
}
