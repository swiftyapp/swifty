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

export const isValid = entry => {
  switch (entry.type) {
    case 'login':
      return entry.title && entry.username && entry.password
    case 'card':
      return (
        entry.title &&
        entry.number &&
        entry.pin &&
        entry.cvc &&
        entry.month &&
        entry.year
      )
    case 'note':
      return entry.title && entry.note
    default:
      return false
  }
}
