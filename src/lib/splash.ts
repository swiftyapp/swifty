// The startup splash lives as static markup in index.html: the mascot at rest
// where the lock screen will draw it, with a wake-up choreography that only
// applies once `splash-live` is on <html>. Gating it on the bundle means it
// starts when the bundle is live — which is also when window.rs reveals the
// window — instead of running unseen behind a hidden one, and that a bundle
// which never runs leaves a whole mascot for window.rs's fallback reveal, not
// a blank frame. This flips the gate and reports when the last animation has
// ended, so the first React frame can take over from the resting pose rather
// than mid-motion.

const LAST = '[data-splash-last]'
// The choreography ends around 1.4s; past this the app renders regardless, so
// a missed `animationend` can never hold the UI hostage.
const CAP_MS = 1600

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

/**
 * Start the splash and resolve once it has settled. Resolves at once when
 * there is no splash to wait for (tests, a reduced-motion user who sees the
 * resting pose immediately).
 */
export const runSplash = (): Promise<void> => {
  document.documentElement.classList.add('splash-live')
  const last = document.querySelector(LAST)
  if (!last || reducedMotion()) return Promise.resolve()

  return new Promise(resolve => {
    const timer = setTimeout(resolve, CAP_MS)
    // `animationend` bubbles, so the descendants' animations would arrive here
    // too; only the marked element's own end counts.
    last.addEventListener('animationend', event => {
      if (event.target !== last) return
      clearTimeout(timer)
      resolve()
    })
  })
}
