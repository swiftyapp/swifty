import { ipcMain } from 'electron'

export const onDataSave = (vault, window) => {
  ipcMain.on('data:save', (event, data) => {
    vault.write(data)
    window.send('data:saved', { data: vault.read() })
  })
}
