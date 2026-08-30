import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('UtilsAPI', {
  isSpectron: () => {
    return process.env.RUNNING_IN_SPECTRON
  }
})
