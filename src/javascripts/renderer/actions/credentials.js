import { ipcRenderer } from 'electron'

export default credentials => {
  return dispatch => {
    ipcRenderer.send('item:save', credentials)
    ipcRenderer.once('item:saved', (event, items) => {
      dispatch({ type: 'SET_ENTRIES', entries: items })
    })
  }
}
