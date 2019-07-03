import { ipcRenderer } from 'electron'
import React from 'react'
import { render } from 'react-dom'
import Swifty from './components/swifty'

import css from 'application.sass'

const renderApp = flow => {
  const root = document.getElementById('root')
  render(<Swifty flow={flow} />, root)
}

ipcRenderer.on('setup', (event, data) => {
  renderApp('setup')
})

ipcRenderer.on('auth', (event, data) => {
  renderApp('auth')
})

ipcRenderer.on('auth:fail', (event, data) => {
  renderApp('auth')
})

ipcRenderer.on('launch', (event, data) => {
  renderApp('main')
})
