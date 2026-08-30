import type { UnlistenFn } from '@tauri-apps/api/event'
import { on, EVENTS } from '@/lib/events'
import type { AppDispatch } from './index'
import { setEntries } from './entriesSlice'
import { auditDone } from './auditSlice'
import { flowAuth } from './flowSlice'
import {
  syncStart,
  syncStop,
  syncConnected,
  syncDisconnected
} from './syncSlice'

// Wires backend events to store dispatches. Returns a cleanup function.
export const subscribeToEvents = (dispatch: AppDispatch): (() => void) => {
  const pending: Promise<UnlistenFn>[] = [
    on(EVENTS.syncStarted, () => dispatch(syncStart())),
    on(EVENTS.syncStopped, payload => dispatch(syncStop(payload))),
    on(EVENTS.syncConnected, () => dispatch(syncConnected())),
    on(EVENTS.syncDisconnected, () => dispatch(syncDisconnected())),
    on(EVENTS.pullStarted, () => dispatch(syncStart())),
    on(EVENTS.pullStopped, payload => {
      dispatch(syncStop(payload))
      if (payload.data) dispatch(setEntries(payload.data.entries))
    }),
    on(EVENTS.auditDone, payload => dispatch(auditDone(payload.data))),
    on(EVENTS.vaultLocked, () => dispatch(flowAuth(false)))
  ]

  return () => {
    pending.forEach(p => p.then(unlisten => unlisten()).catch(() => {}))
  }
}
