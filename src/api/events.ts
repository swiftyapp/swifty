import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { SetupDriveFile } from './setup'
import type { SyncStatus } from './sync'
import type { EntryMeta } from './types'

/**
 * The event catalog. The backend `emit`s these; the frontend `listen`s. Used for
 * background work (sync, auto-lock, a long import) that is not a direct
 * request/response command.
 *
 * `setup:drive:pending` → `setup:drive:probed` | `setup:drive:error` is a
 * consent flow out with the browser against an account there is no vault behind
 * yet. The backend owns all three: it is what opens the browser and what hears
 * back from it, so the frontend mirrors these rather than guessing from a click
 * — the command itself resolves the moment the browser is on screen. `file:
 * null` there is an account with no Rowel data in it, a fact rather than a
 * failure, so it is not an error event.
 */
export interface EventPayloads {
  'vault:locked': void
  /**
   * A sync pulled entries this device did not have. Carries the whole refreshed
   * list rather than a "reload" ping so the store updates in one render, and
   * because the backend has already paid for the query.
   */
  'vault:merged': { entries: EntryMeta[] }
  /**
   * The whole of sync, every time anything about it changes: a consent flow
   * opening or closing, a run starting or ending. The frontend stores it as-is
   * — there is no sequence of events to reconstruct state from.
   */
  'sync:status': SyncStatus
  'import:progress': { done: number; total: number }
  'setup:drive:pending': void
  'setup:drive:probed': { file: SetupDriveFile | null }
  'setup:drive:error': { error: string }
}

export type EventName = keyof EventPayloads

type Camel<S extends string> = S extends `${infer Head}:${infer Tail}`
  ? `${Head}${Capitalize<Camel<Tail>>}`
  : S

/**
 * Call-site names for the events. Derived from `EventPayloads`, so adding an
 * event without a key here — or keeping a key whose event is gone — fails the
 * build rather than drifting.
 */
export const EVENTS: { [K in EventName as Camel<K>]: K } = {
  vaultLocked: 'vault:locked',
  vaultMerged: 'vault:merged',
  syncStatus: 'sync:status',
  importProgress: 'import:progress',
  setupDrivePending: 'setup:drive:pending',
  setupDriveProbed: 'setup:drive:probed',
  setupDriveError: 'setup:drive:error'
}

// Typed wrapper over Tauri's `listen`.
export const on = <E extends EventName>(
  event: E,
  handler: (payload: EventPayloads[E]) => void
): Promise<UnlistenFn> => listen<EventPayloads[E]>(event, e => handler(e.payload))
