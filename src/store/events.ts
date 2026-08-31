import type { UnlistenFn } from '@tauri-apps/api/event'
import { on, EVENTS } from '@/lib/events'
import {
  setEntries,
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
    on(EVENTS.auditDone, payload => auditDone(payload.data)),
    on(EVENTS.vaultLocked, () => flowAuth(false))
  ]

  return () => {
    pending.forEach(p => p.then(unlisten => unlisten()).catch(() => {}))
  }
}
