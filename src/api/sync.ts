import { call } from './client'
import { describeError, type BackendErrorKind } from './errors'

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
  /**
   * The kind of that failure, always set alongside `error`. A failed run is
   * reported as status rather than as a rejected promise, so this is what lets
   * a screen recognise one particular failure without reading the English
   * sentence Rust built — the same contract every rejection has.
   */
  errorKind: BackendErrorKind | null
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
 * The last failure as copy the user can read, or null when there was none.
 * `describeError` over the two halves the status carries, so a sync failure
 * reads the same as the identical failure raised from a command.
 */
export const syncErrorText = (sync: SyncStatus): string | null =>
  sync.error === null
    ? null
    : describeError({ kind: sync.errorKind ?? 'other', message: sync.error })

/**
 * This vault's pack was deleted from the account on another device, so its runs
 * stop here until it is removed from this one too (`workspaceDelete`).
 */
export const syncDeletedRemotely = (sync: SyncStatus): boolean =>
  sync.errorKind === 'vaultDeletedRemotely'

/**
 * Start the Google consent flow for the open vault. Returns immediately on
 * every platform: the backend probes the account first and reports on
 * `setup:drive:pending`, then one of `setup:drive:probed` / `setup:drive:error`
 * — the same events the first run and Settings › Workspaces listen to. A
 * rejection here is an immediate guard failure (another setup step running)
 * and has already been reported as `sync:status`.
 *
 * A probe leaves the account's tokens pending and its vaults listed; whether
 * this vault may join the account is then `syncAdoptPending`'s to say.
 */
export const syncConnect = (): Promise<void> => call('sync_connect')

export const syncDisconnect = (): Promise<void> => call('sync_disconnect')

export const syncNow = (): Promise<void> => call('sync_now')

/**
 * Ask the backend to make the account a probe left pending this vault's. It
 * lists the account's vaults with the pending tokens and decides: an account
 * holding no vault takes this one as its first, and one already holding this
 * vault's id takes it as another device of it — the tokens are sealed under the
 * open vault's key and the first sync runs, reporting through `sync:status`
 * like a connect. An account holding only *other* vaults rejects with
 * `vaultNotInAccount` and leaves the tokens pending, so the caller offers those
 * vaults to restore (`workspaceRestoreFromDrive`) instead of adding a pack
 * beside them.
 */
export const syncAdoptPending = (): Promise<void> => call('sync_adopt_pending')
