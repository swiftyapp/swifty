import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { appStatus } from './api/app'
import { hydratePrefs, setApp, setUpdateReady, usePrefs } from './store'
import { runStartupUpdateCheck } from './services/autoUpdate'
import { applyTheme } from './theme'
import { DEFAULT_LOCALE, initI18n } from './i18n'
import { runSplash } from './lib/splash'
import { adoptLegacyPrefs } from './lib/legacyPrefs'
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

// One probe, and everything the shell opens with comes out of it: the
// preferences (the theme among them, which the splash in index.html recolors
// off `data-theme`), the language the catalog is loaded for, and — kept whole
// in the app store — which flow to open on and what the lock screen may offer.
// A dead IPC call must not stop the app starting, so a rejection falls back to
// the same defaults a fresh install would show, and `status` stays null for
// everyone reading it.
//
// Between the probe and the hydration, a build that kept its preferences in
// localStorage gets them carried into Rust's file (see lib/legacyPrefs), and
// the probe is re-read so `locale` is Rust's resolution of the stored choice.
const booted = appStatus()
  .then(adoptLegacyPrefs)
  .then(status => {
    setApp(status)
    hydratePrefs(status.settings)
    return status.locale
  })
  .catch(() => DEFAULT_LOCALE)
  .then(locale => {
    applyTheme(usePrefs.getState().theme)
    return locale
  })

// The splash starts once the theme is on the document, so a saved preference
// that disagrees with the OS recolors the resting mascot before it moves rather
// than mid-choreography. Until then index.html paints the OS scheme.
const splashSettled = booted.then(runSplash)
const settled = booted.then(initI18n)

// Awaiting the catalog before the first paint means no flash of English on a
// non-default language, and no Suspense boundary threaded through the tree.
// Awaiting the splash means the lock screen takes over from the mascot at rest
// (same pixels), so the swap reads as one continuous scene.
void Promise.all([settled, splashSettled]).then(() =>
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
