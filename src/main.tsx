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
// Design tokens + base (Tailwind v4). Sole stylesheet now the SASS is gone.
import './styles/theme.css'

applyPlatform()
applyTheme(getTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// E2E state-reset bridge. Dynamic import behind the DEV flag: Vite substitutes
// a literal `false` here for production builds, so the branch — and the module
// behind it — never reach a shipped bundle. E2E runs against the dev server.
if (import.meta.env.DEV) {
  void import('./lib/e2e').then(({ installE2EBridge }) => installE2EBridge())
}

// Stage any signed update in the background; the toast surfaces it when ready.
void runStartupUpdateCheck((version, notes) =>
  useStore.getState().setUpdateReady(version, notes)
)
