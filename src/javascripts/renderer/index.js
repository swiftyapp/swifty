import css from 'application.sass'
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
  const root = document.getElementById('root')
  render(
    <Provider store={store}>
      <Swifty />
    </Provider>,
    root
  )
}

ipcRenderer.on('setup', (event, data) => {
  store.dispatch({ type: 'FLOW_SETUP' })
})

ipcRenderer.on('auth', (event, data) => {
  store.dispatch({ type: 'FLOW_AUTH' })
})

ipcRenderer.on('auth:fail', (event, data) => {
  store.dispatch({ type: 'AUTH_FAIL' })
})

ipcRenderer.on('auth:success', (event, data) => {
  store.dispatch({ type: 'AUTH_SUCCESS' })
  store.dispatch({ type: 'FLOW_MAIN' })
})
