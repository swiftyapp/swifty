import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { usePrefs, setUpdateReady } from './store'
import { runStartupUpdateCheck } from './services/autoUpdate'
import { applyPlatform } from './utils/platform'
import { applyTheme } from './theme'
import { i18nReady } from './i18n'
import { runSplash } from './lib/splash'
// Design tokens + base (Tailwind v4). Sole stylesheet now the SASS is gone.
// Type comes from the OS system stack (see --font-sans) — no bundled webfonts.
import './styles/theme.css'

// Disable browser reload shortcuts (Cmd/Ctrl+R, F5) inside the webview: a
// reload throws away the unlocked session and drops the user back on the lock
// screen, which is never what the keystroke was meant to do here.
const blockReloadShortcuts = () => {
  window.addEventListener('keydown', e => {
    const isReload =
      e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r')
    if (isReload) e.preventDefault()
  })
}

blockReloadShortcuts()
applyPlatform()
// Theme first: the splash in index.html recolors off `data-theme` the moment
// it is set, before its animation starts.
applyTheme(usePrefs.getState().theme)
const splashSettled = runSplash()

// Awaiting the catalog before the first paint means no flash of English on a
// non-default language, and no Suspense boundary threaded through the tree.
// Awaiting the splash means the lock screen takes over from the mascot at rest
// (same pixels), so the swap reads as one continuous scene.
void Promise.all([i18nReady, splashSettled]).then(() =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
)

// E2E state-reset bridge. Dynamic import behind the DEV flag: Vite substitutes
// a literal `false` here for production builds, so the branch — and the module
// behind it — never reach a shipped bundle. E2E runs against the dev server.
if (import.meta.env.DEV) {
  void import('./lib/e2e').then(({ installE2EBridge }) => installE2EBridge())
}

// Stage any signed update in the background; the toast surfaces it when ready.
void runStartupUpdateCheck(setUpdateReady)
