import { contextBridge, remote, shell } from 'electron'
import { isWindows, platform } from 'application/helpers/os'

contextBridge.exposeInMainWorld('RemoteAPI', {
  isWindows: () => {
    return isWindows()
  },

  platform: () => {
    return platform()
  },

  showSaveDialog: callback => {
    remote.dialog.showSaveDialog({ defaultPath: 'vault.swftx' }).then(callback)
  },

  minimizeWindow: () => {
    const win = remote.getCurrentWindow()
    win.minimize()
  },

  maximizeWindow: () => {
    const win = remote.getCurrentWindow()
    win.maximize()
  },

  unmaximizeWindow: () => {
    const win = remote.getCurrentWindow()
    win.unmaximize()
  },

  closeWindow: () => {
    const win = remote.getCurrentWindow()
    win.close()
  },

  openLink: url => {
    shell.openExternal(url)
  }
})
