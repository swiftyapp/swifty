import { contextBridge, ipcRenderer } from 'electron'

const IPC_TIMEOUT = 2000
const RESPONSE_EVENT = 'vault:saved'

const request = (requesEvent, responseEvent, data) => {
  return new Promise((resolve, reject) => {
    ipcRenderer.send(requesEvent, data)

    const timeout = setTimeout(() => {
      reject('IPC_ERROR: Inter process communication timeout')
    }, IPC_TIMEOUT)

    ipcRenderer.once(responseEvent, (_, response) => {
      clearTimeout(timeout)
      resolve(response)
    })
  })
}

contextBridge.exposeInMainWorld('VaultAPI', {
  addItem: data => request('item:add', RESPONSE_EVENT, data),
  updateItem: data => request('item:update', RESPONSE_EVENT, data),
  removeItem: data => request('item:remove', RESPONSE_EVENT, data)
})
