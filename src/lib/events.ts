import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Audit, EntryMeta, SetupDriveFile, SyncStatus } from './commands'

/**
 * Frozen event catalog. The backend `emit`s these; the frontend `listen`s.
 * Used for background work (sync, audit, auto-lock) that isn't a direct
 * request/response command.
 */

export const EVENTS = {
  syncStatus: 'sync:status',
  vaultMerged: 'vault:merged',
  auditDone: 'audit:done',
  vaultLocked: 'vault:locked',
  importProgress: 'import:progress',
  importDone: 'import:done',
  setupDrivePending: 'setup:drive:pending',
  setupDriveProbed: 'setup:drive:probed',
  setupDriveError: 'setup:drive:error'
} as const

/**
 * A consent flow ended without a connection. The backend owns the flow: it is
 * what opens the browser and what hears back from it, so the frontend mirrors
 * what it says rather than guessing from a click or a command's promise.
 */
export interface SyncErrorPayload {
  error: string
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

/**
 * The first-run Drive probe answered. `file: null` is a Google account with no
 * Rowel data in it yet — a fact, not a failure, so it is not an error event.
 */
export interface SetupDriveProbedPayload {
  file: SetupDriveFile | null
}

// Maps each event to its payload type (void = no payload).
export interface EventPayloads {
  /**
   * The whole of sync, every time anything about it changes: a consent flow
   * opening or closing, a run starting or ending. The frontend stores it as-is
   * — there is no sequence of events to reconstruct state from.
   */
  'sync:status': SyncStatus
  'vault:merged': VaultMergedPayload
  'audit:done': AuditDonePayload
  'vault:locked': void
  'import:progress': ImportProgressPayload
  'import:done': ImportDonePayload
  'setup:drive:pending': void
  'setup:drive:probed': SetupDriveProbedPayload
  'setup:drive:error': SyncErrorPayload
}

export type EventName = keyof EventPayloads

// Typed wrapper over Tauri's `listen`.
export const on = <E extends EventName>(
  event: E,
  handler: (payload: EventPayloads[E]) => void
): Promise<UnlistenFn> =>
  listen<EventPayloads[E]>(event, e => handler(e.payload))
