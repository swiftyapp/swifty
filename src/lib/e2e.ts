import { invoke } from '@tauri-apps/api/core'

/**
 * Dev-only bridge to the backend's `e2e_reset` command, so a spec can put the
 * vault into a known state between tests.
 *
 * Zero production footprint: the only caller guards on `import.meta.env.DEV`
 * and imports this module dynamically, so Vite folds the branch to `false` and
 * drops the whole module from a production bundle. The command it calls is in
 * turn compiled out of release binaries (see `src-tauri/src/commands/e2e.rs`).
 *
 * The bridge deliberately does NOT reload the page: navigating while a
 * WebDriver script is still resolving tears the execution context out from
 * under the driver. The spec helper reloads through `browser.refresh()`
 * instead, which waits for the new document properly.
 */

export type E2EResetMode = 'pristine' | 'empty'

declare global {
  interface Window {
    __e2eReset?: (mode: E2EResetMode, password?: string) => Promise<void>
  }
}

export function installE2EBridge(): void {
  window.__e2eReset = (mode, password) =>
    invoke('e2e_reset', { mode, password: password ?? null })
}
