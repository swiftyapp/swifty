import { ipcRenderer } from 'electron'

export const deleteEntry = id => {
  return dispatch => {
    ipcRenderer.send('item:remove', id)
    ipcRenderer.once('item:removed', (event, items) => {
      dispatch({ type: 'ENTRY_REMOVED', entries: items })
    })
  }
}

export const saveEntry = credentials => {
  return dispatch => {
    ipcRenderer.send('item:save', credentials)
    ipcRenderer.once('item:saved', (event, data) => {
      dispatch({ type: 'SET_ENTRIES', ...data })
      dispatch({ type: 'ENTRY_SAVED', ...data })
    })
  }
}
