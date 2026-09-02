import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useStore } from './store'
import { runStartupUpdateCheck } from './services/autoUpdate'
import { applyPlatform } from './utils/platform'
import { applyTheme, getTheme } from './theme'
import './shortcuts'
// Design tokens + base (Tailwind v4). Sole stylesheet now the SASS is gone.
// Type comes from the OS system stacks (see --font-sans/--font-mono) — no
// bundled webfonts.
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
