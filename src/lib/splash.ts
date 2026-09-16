// The startup splash lives as static markup in index.html: the mascot at rest,
// on screen from the very first frame, with the choreography behind a class so
// it only plays once the bundle is live. Two calls drive it — one to start the
// motion, one to hand the screen to React — and neither of them makes the app
// wait: the lock screen draws the same mascot in the same pixels, so the fade
// covers a swap mid-animation as readily as one from the resting pose.

const SPLASH = 'splash'
// Long enough to cover the fade in index.html, plus slack: a node that is never
// transitioned (reduced motion, a hidden window) fires no `transitionend`, and
// an abandoned overlay would swallow nothing but would still be in the tree.
const REMOVE_AFTER_MS = 600

/** Arm the choreography. Synchronous, so the first revealed frame is its first. */
export const startSplash = (): void => {
  document.documentElement.classList.add('splash-live')
}

/** Fade the splash out over whatever React has just committed, then drop it. */
export const finishSplash = (): void => {
  document.documentElement.classList.add('splash-done')
  const node = document.getElementById(SPLASH)
  if (!node) return

  const remove = () => node.remove()
  node.addEventListener('transitionend', remove, { once: true })
  setTimeout(remove, REMOVE_AFTER_MS)
}
