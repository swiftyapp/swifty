import { boot } from './boot'
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

void boot()

// E2E state-reset bridge. Dynamic import behind the DEV flag: Vite substitutes
// a literal `false` here for production builds, so the branch — and the module
// behind it — never reach a shipped bundle. E2E runs against the dev server.
if (import.meta.env.DEV) {
  void import('./lib/e2e').then(({ installE2EBridge }) => installE2EBridge())
}
