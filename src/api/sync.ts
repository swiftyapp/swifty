import { call } from './client'

/**
 * Start the Google consent flow. Returns immediately on every platform: the
 * outcome arrives as `sync:pending` and then exactly one of `sync:connected` /
 * `sync:error`. A rejection here is an immediate guard failure (no OAuth client
 * configured) and is shown the same way an error event is.
 */
export const syncConnect = (): Promise<void> => call('sync_connect')

export const syncDisconnect = (): Promise<void> => call('sync_disconnect')

export const syncNow = (): Promise<void> => call('sync_now')

/** Pull the remote pack into this vault. Reports through the same events. */
export const syncImport = (): Promise<void> => call('sync_import')
