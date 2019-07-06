import { ipcRenderer } from 'electron'
import { useDispatch } from 'react-redux'

export default credentials => {
  ipcRenderer.send('item:save', credentials)
  ipcRenderer.once('item:saved', items => {
    console.log(items)
  })
  console.log(useDispatch)
}
