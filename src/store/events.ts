import type { UnlistenFn } from '@tauri-apps/api/event'
import { on, EVENTS } from '@/api/events'
import {
  setSyncStatus,
  setupDrivePending,
  setupDriveProbed,
  setupDriveFailed,
  setRemoteVaults,
  clearSession,
  showLockScreen,
  fileOpened
} from './app'
import { setEntries, loadArchive, runAudit } from './vault'
import { useUi } from './ui'

// A merge can add or drop tombstones as readily as live entries, but the Archive
// only loads on entering the view — so an open Archive would sit stale until the
// user navigated away and back. Anywhere else there is nothing on screen to
// correct, and the next visit refetches anyway.
const refreshOpenArchive = () => {
  if (useUi.getState().view === 'archive') void loadArchive()
}

// Wires backend events to store actions. Returns a cleanup function.
export const subscribeToEvents = (): (() => void) => {
  const pending: Promise<UnlistenFn>[] = [
    on(EVENTS.syncStatus, setSyncStatus),
    // A merge brought in entries from another device: refresh the list, and the
    // audit with it — the new rows have no strength or breach result yet.
    on(EVENTS.vaultMerged, payload => {
      setEntries(payload.entries)
      void runAudit()
      refreshOpenArchive()
    }),
    // The first run's own consent flow: the same pending/result/error trio as
    // sync, against an account there is no vault behind yet.
    on(EVENTS.setupDrivePending, () => setupDrivePending()),
    on(EVENTS.setupDriveProbed, payload => setupDriveProbed(payload.files)),
    on(EVENTS.setupDriveError, payload => setupDriveFailed(payload.error)),
    on(EVENTS.workspacesRemote, payload => setRemoteVaults(payload.files)),
    // The one reaction to a lock, whoever asked for it: the lock command, the
    // inactivity autolock, the tray, a workspace switch. Every one of them ends
    // in `session::lock` on the Rust side, so none of them has to hand-roll
    // this — and none of them can forget half of it.
    on(EVENTS.vaultLocked, () => {
      clearSession()
      void showLockScreen()
    }),
    // A backup double-clicked while the app is up. The one opened *with* the
    // app is collected separately, once this is listening (see `App.tsx`).
    on(EVENTS.fileOpened, payload => fileOpened(payload.path))
  ]

  return () => {
    pending.forEach(p => p.then(unlisten => unlisten()).catch(() => {}))
  }
}
