import { remote } from 'electron'

window.showSaveDialog = callback => {
  remote.dialog.showSaveDialog({ defaultPath: 'vault.swftx' }).then(callback)
}
