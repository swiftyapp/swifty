import type { UnlistenFn } from '@tauri-apps/api/event'
import { on, EVENTS } from '@/lib/events'
import {
  setSyncStatus,
  setupDrivePending,
  setupDriveProbed,
  setupDriveFailed,
  clearSession,
  showLockScreen
} from './app'
import { setEntries, loadArchive, runAudit, auditDone } from './vault'
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
    on(EVENTS.auditDone, payload => auditDone(payload.data)),
    // The first run's own consent flow: the same pending/result/error trio as
    // sync, against an account there is no vault behind yet.
    on(EVENTS.setupDrivePending, () => setupDrivePending()),
    on(EVENTS.setupDriveProbed, payload => setupDriveProbed(payload.file)),
    on(EVENTS.setupDriveError, payload => setupDriveFailed(payload.error)),
    // Autolock: the same path as a manual `lockVault`, minus the lock command
    // the backend has already run.
    on(EVENTS.vaultLocked, () => {
      clearSession()
      void showLockScreen()
    })
  ]

  return () => {
    pending.forEach(p => p.then(unlisten => unlisten()).catch(() => {}))
  }
}
