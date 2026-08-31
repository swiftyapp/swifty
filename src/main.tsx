import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store'
import { runStartupUpdateCheck } from './services/autoUpdate'
import { applyPlatform } from './utils/platform'
import './shortcuts'
import './styles/application.sass'

applyPlatform()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Stage any signed update in the background; the toast surfaces it when ready.
void runStartupUpdateCheck((version, notes) =>
  useStore.getState().setUpdateReady(version, notes)
)
