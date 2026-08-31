import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store'
import { runStartupUpdateCheck } from './services/autoUpdate'
import { applyPlatform } from './utils/platform'
import { applyTheme, getTheme } from './theme'
import './shortcuts'
// Self-hosted fonts (bundled, no runtime CDN — the app stays fully offline).
import '@fontsource-variable/geist/wght.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
// Design tokens (Tailwind v4). Imported before the legacy SASS so the SASS
// still wins for anything it styles during the incremental migration.
import './styles/theme.css'
import './styles/application.sass'

applyPlatform()
applyTheme(getTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Stage any signed update in the background; the toast surfaces it when ready.
void runStartupUpdateCheck((version, notes) =>
  useStore.getState().setUpdateReady(version, notes)
)
