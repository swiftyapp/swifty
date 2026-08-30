import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Audit, VaultData } from './commands'

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
  pullStarted: 'vault:pull:started',
  pullStopped: 'vault:pull:stopped',
  auditDone: 'audit:done',
  vaultLocked: 'vault:locked'
} as const

export interface SyncStoppedPayload {
  success: boolean
  error?: string
}

export interface PullStoppedPayload {
  success: boolean
  data?: VaultData
  error?: string
}

export interface AuditDonePayload {
  data: Audit
}

// Maps each event to its payload type (void = no payload).
export interface EventPayloads {
  'sync:started': void
  'sync:stopped': SyncStoppedPayload
  'sync:connected': void
  'sync:disconnected': void
  'vault:pull:started': void
  'vault:pull:stopped': PullStoppedPayload
  'audit:done': AuditDonePayload
  'vault:locked': void
}

export type EventName = keyof EventPayloads

// Typed wrapper over Tauri's `listen`.
export const on = <E extends EventName>(
  event: E,
  handler: (payload: EventPayloads[E]) => void
): Promise<UnlistenFn> =>
  listen<EventPayloads[E]>(event, e => handler(e.payload))
