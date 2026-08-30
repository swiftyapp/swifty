import { contextBridge, clipboard } from 'electron'

contextBridge.exposeInMainWorld('ClipboardAPI', {
  copyToClipboard: (value, timeout = false) => {
    clipboard.writeText(value)
    if (timeout) {
      setTimeout(() => {
        clipboard.clear()
      }, timeout)
    }
  }
})
