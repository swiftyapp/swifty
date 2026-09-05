import type { UnlistenFn } from '@tauri-apps/api/event'
import { on, EVENTS } from '@/lib/events'
import { isBiometricAvailable } from '@/lib/commands'
import {
  useStore,
  setEntries,
  loadArchive,
  runAudit,
  auditDone,
  flowAuth,
  syncStart,
  syncStop,
  syncConnected,
  syncFailed,
  syncDisconnected,
  resetVaultData
} from './index'

// A merge can add or drop tombstones as readily as live entries, but the Archive
// only loads on entering the view — so an open Archive would sit stale until the
// user navigated away and back. Anywhere else there is nothing on screen to
// correct, and the next visit refetches anyway.
const refreshOpenArchive = () => {
  if (useStore.getState().ui.view === 'archive') void loadArchive()
}

// Wires backend events to store actions. Returns a cleanup function.
export const subscribeToEvents = (): (() => void) => {
  const pending: Promise<UnlistenFn>[] = [
    on(EVENTS.syncStarted, () => syncStart()),
    on(EVENTS.syncStopped, payload => syncStop(payload)),
    on(EVENTS.syncConnected, () => syncConnected()),
    on(EVENTS.syncError, payload => syncFailed(payload.error)),
    on(EVENTS.syncDisconnected, () => syncDisconnected()),
    on(EVENTS.pullStarted, () => syncStart()),
    on(EVENTS.pullStopped, payload => {
      syncStop(payload)
      if (payload.data) setEntries(payload.data.entries)
      refreshOpenArchive()
    }),
    // A merge brought in entries from another device: refresh the list, and the
    // audit with it — the new rows have no strength or breach result yet.
    on(EVENTS.vaultMerged, payload => {
      setEntries(payload.entries)
      runAudit()
      refreshOpenArchive()
    }),
    on(EVENTS.auditDone, payload => auditDone(payload.data)),
    // Ask, don't assume: hardcoding `false` here meant the Touch ID button only
    // ever appeared on a fresh boot (App.tsx runs the same check), never on an
    // in-session lock — including the very first lock after enabling it.
    on(EVENTS.vaultLocked, () => {
      // Autolock takes this path instead of `lockVault`, so the session data
      // has to be dropped here too.
      resetVaultData()
      return isBiometricAvailable()
        .catch(() => false)
        .then(flowAuth)
    })
  ]

  return () => {
    pending.forEach(p => p.then(unlisten => unlisten()).catch(() => {}))
  }
}
