import { call } from './client'

/**
 * The whole of what the frontend knows about sync, carried by every
 * `sync:status` event (see `events.ts`). The store keeps it verbatim: the
 * backend owns every flow — it opens the browser, hears back from it, runs the
 * sync — so it is the one that can say.
 */
export interface SyncStatus {
  /** This vault has a provider connected. */
  configured: boolean
  /** A consent flow is out with the browser. */
  pending: boolean
  inProgress: boolean
  /** What the last connect or run failed with, until the next one starts. */
  error: string | null
  /** ISO time of the last run that succeeded in this process, or null. */
  lastSyncedAt: string | null
  /**
   * The backend's count of transitions so far, monotonic within the process.
   * Two snapshots reach the store by different routes — the `sync:status`
   * event and the `app_status` probe — and can arrive out of order; the store
   * keeps whichever has the higher `seq` (`setSyncStatus`).
   */
  seq: number
}

/**
 * Start the Google consent flow. Returns immediately on every platform: the
 * outcome arrives as `sync:status`, pending first and then either connected or
 * carrying an error. A rejection here is an immediate guard failure (no OAuth
 * client configured, vault locked) and has already been reported as status.
 */
export const syncConnect = (): Promise<void> => call('sync_connect')

export const syncDisconnect = (): Promise<void> => call('sync_disconnect')

export const syncNow = (): Promise<void> => call('sync_now')

/** Pull the remote pack into this vault. Reports through the same status. */
export const syncImport = (): Promise<void> => call('sync_import')
