import { ipcRenderer } from 'electron'
import React from 'react'
import { render } from 'react-dom'
import Swifty from './components/swifty'

import css from 'application.sass'

const renderApp = flow => {
  const root = document.getElementById('root')
  render(<Swifty flow={flow} />, root)
}

ipcRenderer.on('prompt-setup', (event, data) => {
  renderApp('setup')
})

ipcRenderer.on('prompt-password', (event, data) => {
  renderApp('auth')
})

ipcRenderer.on('invalid-password', (event, data) => {
  renderApp('auth')
})

ipcRenderer.on('launch-app', (event, data) => {
  renderApp('main')
})
