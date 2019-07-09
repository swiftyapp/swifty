import { ipcRenderer } from 'electron'

export const deleteEntry = id => {
  return dispatch => {
    ipcRenderer.send('item:remove', id)
    ipcRenderer.once('item:removed', (event, items) => {
      dispatch({ type: 'ENTRY_REMOVED', entries: items })
    })
  }
}
