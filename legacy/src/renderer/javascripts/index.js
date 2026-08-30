import 'application.sass'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import thunkMiddleware from 'redux-thunk'
import rootReducer from 'reducers'
import './shortcuts'

import Swifty from './components/swifty'

const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat([thunkMiddleware])
})

let root

window.onload = () => {
  root = ReactDOM.createRoot(document.getElementById('root'))
}

const renderApplication = i18n => {
  const locale = localStorage.getItem('locale')
  i18n.locale = locale ? locale : i18n.locale
  window._i18n = i18n
  window.i18n = key => i18n.translations[i18n.locale][key] || key

  document
    .querySelector('body')
    .setAttribute('platform', window.AppAPI.platform())

  root.render(
    <Provider store={store}>
      <Swifty />
    </Provider>
  )
}
window.refreshApplication = () => renderApplication(window._i18n)

window.MessagesAPI.onMessage('onload', (_, i18n) => {
  renderApplication(i18n)
})

window.MessagesAPI.onMessage('setup', () => {
  store.dispatch({ type: 'FLOW_SETUP' })
})

window.MessagesAPI.onMessage('auth', (_, touchID) => {
  store.dispatch({ type: 'FLOW_AUTH', touchID: touchID })
})

window.MessagesAPI.onMessage('auth:success', (_, options) => {
  document.getElementById('root').setAttribute('platform', options.platform)
  store.dispatch({ type: 'SET_ENTRIES', data: options.data })
  store.dispatch({ type: 'FLOW_MAIN' })
  store.dispatch({ type: 'SYNC_INIT', enabled: options.sync })
})

window.MessagesAPI.onMessage('audit:done', (_, { data }) => {
  store.dispatch({ type: 'AUDIT_DONE', data })
})

window.MessagesAPI.onMessage('vault:sync:started', () => {
  store.dispatch({ type: 'SYNC_START' })
})

window.MessagesAPI.onMessage('vault:sync:stopped', (_, options) => {
  store.dispatch({ type: 'SYNC_STOP', ...options })
})

window.MessagesAPI.onMessage('vault:pull:started', () => {
  store.dispatch({ type: 'SYNC_START' })
})

window.MessagesAPI.onMessage(
  'vault:pull:stopped',
  (_, { success, error, data }) => {
    store.dispatch({ type: 'SYNC_STOP', success, error })
    if (data) store.dispatch({ type: 'SET_ENTRIES', data: data })
  }
)

window.MessagesAPI.onMessage('vault:sync:disconnected', () => {
  store.dispatch({ type: 'SYNC_DISCONNECTED' })
})

window.MessagesAPI.onMessage('vault:sync:connected', () => {
  store.dispatch({ type: 'SYNC_CONNECTED' })
})
