import 'application.sass'
import { ipcRenderer } from 'electron'
import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import thunkMiddleware from 'redux-thunk'
import rootReducer from 'reducers'

import Swifty from './components/swifty'

const store = createStore(rootReducer, applyMiddleware(thunkMiddleware))

window.onload = () => {
  render(
    <Provider store={store}>
      <Swifty />
    </Provider>,
    document.getElementById('root')
  )
}

ipcRenderer.on('setup', () => {
  store.dispatch({ type: 'FLOW_SETUP' })
})

ipcRenderer.on('auth', (event, touchID) => {
  store.dispatch({ type: 'FLOW_AUTH', touchID: touchID })
})

ipcRenderer.on('auth:success', (event, data) => {
  document.getElementById('root').setAttribute('platform', data.platform)
  store.dispatch({ type: 'SET_ENTRIES', entries: data.entries })
  store.dispatch({ type: 'FLOW_MAIN' })
  store.dispatch({ type: 'SYNC_INIT', enabled: data.sync })
})

ipcRenderer.on('vault:sync:started', () => {
  store.dispatch({ type: 'SYNC_START' })
})

ipcRenderer.on('vault:sync:stopped', (event, data) => {
  store.dispatch({ type: 'SYNC_STOP', ...data })
})

ipcRenderer.on('vault:sync:disconnected', () => {
  store.dispatch({ type: 'SYNC_DISCONNECTED' })
})

ipcRenderer.on('vault:sync:connected', () => {
  store.dispatch({ type: 'SYNC_CONNECTED' })
})
