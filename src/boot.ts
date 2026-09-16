import { createElement, StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
import { appReady, appStatus } from '@/api/app'
import { hydratePrefs, setApp, setUpdateReady, usePrefs } from '@/store'
import { runStartupUpdateCheck } from '@/services/autoUpdate'
import { applyTheme } from '@/theme'
import { changeLocale, DEFAULT_LOCALE, initI18n } from '@/i18n'
import { startSplash } from '@/lib/splash'

/**
 * Launch, from the injected boot payload to React's first commit.
 *
 * Two things gate the first frame and they run side by side: the catalogue for
 * the language, and the probe that says which flow to open on. Neither may keep
 * the app off screen if it fails — a host without a backend still gets a lock
 * screen, which re-probes on its own (see `App.tsx`).
 *
 * The splash is not one of the gates. It is armed synchronously, the window is
 * revealed on the same tick, and React takes over whenever it is ready: the
 * lock screen draws the same mascot in the same pixels, so a handover
 * mid-choreography reads as a cross-fade rather than a cut.
 */

// Long enough to be after the first commit on any machine, short enough that a
// staged update is still found in the session it was published in. Off the boot
// path entirely: the check makes a network request and writes to disk, and
// nothing on screen waits for it.
const UPDATE_CHECK_DELAY_MS = 2_000

/**
 * The injected payload, or null on any host that did not inject one (vitest, a
 * plain browser). Checked field by field rather than trusted: it is the one
 * input that arrives before the app can have validated anything.
 */
const injectedBoot = (): RowelBoot | null => {
  const boot: unknown = window.__ROWEL_BOOT__
  if (!boot || typeof boot !== 'object') return null
  const { locale, settings } = boot as Partial<RowelBoot>
  if (typeof locale !== 'string' || !settings || typeof settings !== 'object') return null
  return { locale, settings }
}

export const boot = async (): Promise<void> => {
  const injected = injectedBoot()
  if (injected) {
    // Before anything can await: the first frame React paints is then already
    // in the stored theme rather than in the default it would start from.
    hydratePrefs(injected.settings)
    applyTheme(usePrefs.getState().theme)
  }
  const locale = injected?.locale ?? DEFAULT_LOCALE

  startSplash()
  // Reveals the window. A failure here only means the fallback timer does it.
  void appReady().catch(() => {})

  const translated = initI18n(locale).catch(() => {})
  const probed = appStatus()
    .then(status => {
      setApp(status)
      hydratePrefs(status.settings)
      applyTheme(usePrefs.getState().theme)
      return status.locale
    })
    // `status` stays null and the shell opens on the lock screen; nothing about
    // a dead probe may leave the app unrendered.
    .catch(() => locale)

  const [, resolved] = await Promise.all([translated, probed])
  // Only reachable when nothing was injected: with a payload, Rust resolved the
  // language before the bundle ran and the catalogue is already the right one.
  if (resolved !== locale) await changeLocale(resolved).catch(() => {})

  ReactDOM.createRoot(document.getElementById('root')!).render(
    createElement(StrictMode, null, createElement(App))
  )

  setTimeout(() => void runStartupUpdateCheck(setUpdateReady), UPDATE_CHECK_DELAY_MS)
}
