import 'application.sass'
import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import thunkMiddleware from 'redux-thunk'
import rootReducer from 'reducers'
import './shortcuts'

import Swifty from './components/swifty'

const store = createStore(rootReducer, applyMiddleware(thunkMiddleware))

window.onload = () => {
  document.querySelector('body').setAttribute('platform', window.platform())
  render(
    <Provider store={store}>
      <Swifty />
    </Provider>,
    document.getElementById('root')
  )
}

window.onMessage('setup', () => {
  store.dispatch({ type: 'FLOW_SETUP' })
})

window.onMessage('auth', (event, touchID) => {
  store.dispatch({ type: 'FLOW_AUTH', touchID: touchID })
})

window.onMessage('auth:success', (event, options) => {
  document.getElementById('root').setAttribute('platform', options.platform)
  store.dispatch({ type: 'SET_ENTRIES', data: options.data })
  store.dispatch({ type: 'FLOW_MAIN' })
  store.dispatch({ type: 'SYNC_INIT', enabled: options.sync })
})

window.onMessage('audit:done', (event, { data }) => {
  store.dispatch({ type: 'AUDIT_DONE', data })
})

window.onMessage('vault:sync:started', () => {
  store.dispatch({ type: 'SYNC_START' })
})

window.onMessage('vault:sync:stopped', (event, options) => {
  store.dispatch({ type: 'SYNC_STOP', ...options })
})

window.onMessage('vault:pull:started', () => {
  store.dispatch({ type: 'SYNC_START' })
})

window.onMessage('vault:pull:stopped', (event, options) => {
  store.dispatch({ type: 'SYNC_STOP', success: options.success })
  store.dispatch({ type: 'SET_ENTRIES', data: options.data })
})

window.onMessage('vault:sync:disconnected', () => {
  store.dispatch({ type: 'SYNC_DISCONNECTED' })
})

window.onMessage('vault:sync:connected', () => {
  store.dispatch({ type: 'SYNC_CONNECTED' })
})
