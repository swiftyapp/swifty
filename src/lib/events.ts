import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Audit, EntryMeta } from './commands'

/**
 * Frozen event catalog. The backend `emit`s these; the frontend `listen`s.
 * Used for background work (sync, audit, auto-lock) that isn't a direct
 * request/response command.
 */

export const EVENTS = {
  syncStarted: 'sync:started',
  syncStopped: 'sync:stopped',
  syncConnected: 'sync:connected',
  syncDisconnected: 'sync:disconnected',
  syncError: 'sync:error',
  pullStarted: 'vault:pull:started',
  pullStopped: 'vault:pull:stopped',
  vaultMerged: 'vault:merged',
  auditDone: 'audit:done',
  vaultLocked: 'vault:locked',
  importProgress: 'import:progress',
  importDone: 'import:done'
} as const

export interface SyncStoppedPayload {
  success: boolean
  error?: string
}

/**
 * A connect attempt failed. Separate from `sync:stopped`, which reports a *run*
 * — on mobile the consent flow finishes long after `sync_connect` resolved, so
 * a rejected promise cannot carry this.
 */
export interface SyncErrorPayload {
  error: string
}

export interface PullStoppedPayload {
  success: boolean
  data?: { entries: EntryMeta[] }
  error?: string
}

/**
 * A sync pulled entries this device did not have. Carries the whole refreshed
 * list rather than a "reload" ping so the store updates in one render, and
 * because the backend has already paid for the query.
 */
export interface VaultMergedPayload {
  entries: EntryMeta[]
}

export interface AuditDonePayload {
  data: Audit
}

export interface ImportProgressPayload {
  done: number
  total: number
}

export interface ImportDonePayload {
  count: number
}

// Maps each event to its payload type (void = no payload).
export interface EventPayloads {
  'sync:started': void
  'sync:stopped': SyncStoppedPayload
  'sync:connected': void
  'sync:disconnected': void
  'sync:error': SyncErrorPayload
  'vault:pull:started': void
  'vault:pull:stopped': PullStoppedPayload
  'vault:merged': VaultMergedPayload
  'audit:done': AuditDonePayload
  'vault:locked': void
  'import:progress': ImportProgressPayload
  'import:done': ImportDonePayload
}

export type EventName = keyof EventPayloads

// Typed wrapper over Tauri's `listen`.
export const on = <E extends EventName>(
  event: E,
  handler: (payload: EventPayloads[E]) => void
): Promise<UnlistenFn> =>
  listen<EventPayloads[E]>(event, e => handler(e.payload))
