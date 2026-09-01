import type { UnlistenFn } from '@tauri-apps/api/event'
import { on, EVENTS } from '@/lib/events'
import {
  setEntries,
  runAudit,
  auditDone,
  flowAuth,
  syncStart,
  syncStop,
  syncConnected,
  syncDisconnected
} from './index'

// Wires backend events to store actions. Returns a cleanup function.
export const subscribeToEvents = (): (() => void) => {
  const pending: Promise<UnlistenFn>[] = [
    on(EVENTS.syncStarted, () => syncStart()),
    on(EVENTS.syncStopped, payload => syncStop(payload)),
    on(EVENTS.syncConnected, () => syncConnected()),
    on(EVENTS.syncDisconnected, () => syncDisconnected()),
    on(EVENTS.pullStarted, () => syncStart()),
    on(EVENTS.pullStopped, payload => {
      syncStop(payload)
      if (payload.data) setEntries(payload.data.entries)
    }),
    // A merge brought in entries from another device: refresh the list, and the
    // audit with it — the new rows have no strength or breach result yet.
    on(EVENTS.vaultMerged, payload => {
      setEntries(payload.entries)
      runAudit()
    }),
    on(EVENTS.auditDone, payload => auditDone(payload.data)),
    on(EVENTS.vaultLocked, () => flowAuth(false))
  ]

  return () => {
    pending.forEach(p => p.then(unlisten => unlisten()).catch(() => {}))
  }
}
