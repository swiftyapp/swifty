import { remote } from 'electron'
import { isWindows, platform } from '../main/application/helpers/os'

window.isWindows = () => {
  return isWindows()
}

window.platform = () => {
  return platform()
}

window.showSaveDialog = callback => {
  remote.dialog.showSaveDialog({ defaultPath: 'vault.swftx' }).then(callback)
}

window.minimizeWindow = () => {
  const win = remote.getCurrentWindow()
  win.minimize()
}

window.maximizeWindow = () => {
  const win = remote.getCurrentWindow()
  win.maximize()
}

window.unmaximizeWindow = () => {
  const win = remote.getCurrentWindow()
  win.unmaximize()
}

window.closeWindow = () => {
  const win = remote.getCurrentWindow()
  win.close()
}

window.toggleMaxRestoreButtons = (maxButton, restoreButton) => {
  const win = remote.getCurrentWindow()
  if (win.isMaximized()) {
    maxButton.style.display = 'none'
    restoreButton.style.display = 'flex'
  } else {
    restoreButton.style.display = 'none'
    maxButton.style.display = 'flex'
  }
}
