import type { TKey } from '@/i18n'
import { syncErrorText, type SyncStatus } from '@/api/sync'

export type SyncTone = 'local' | 'idle' | 'loading' | 'good' | 'bad'

export interface SyncView {
  tone: SyncTone
  /**
   * A catalogue key, not a sentence. Typed as `TKey`, so a message with no
   * en-US entry fails the build rather than reaching a user in English. That
   * type is the whole guard here: the i18n suite scans for literal translation
   * calls, so a sentence picked in this module and translated from a variable
   * at the call site would be invisible to it.
   */
  message: TKey
  /**
   * What the failure was, shown in place of `message`. Translated where the
   * backend named a kind the catalogues cover (`syncErrorText`) and the
   * backend's own words otherwise. Either way it is a sentence, not a
   * catalogue key, which is what lets `message` stay honestly typed instead of
   * casting an arbitrary string to `TKey`.
   */
  detail?: string
}

/**
 * The chip's five states, in priority order, from the backend's sync status.
 *
 * Ordering matters: a run in flight outranks the previous run's verdict, so a
 * retry after a failure reads as "syncing" rather than staying red until it
 * lands. `lastSyncedAt` is what promotes the chip to "good": a vault connected
 * a second ago has not synced yet, and must not claim to be up to date.
 */
export const syncView = (sync: SyncStatus): SyncView => {
  if (!sync.configured)
    return { tone: 'local', message: 'Changes are saved on this device only' }
  if (sync.inProgress) return { tone: 'loading', message: 'Syncing…' }
  if (sync.error !== null)
    return {
      tone: 'bad',
      message: 'Something went wrong',
      detail: syncErrorText(sync) ?? undefined
    }
  // Connected, but nothing has landed yet. Deliberately not `loading`: if the
  // first run never starts, a spinner here would turn on at unlock and never
  // stop. A quiet cloud with no badge claims nothing instead.
  if (!sync.lastSyncedAt) return { tone: 'idle', message: 'Waiting to sync' }
  return { tone: 'good', message: 'Sync Successful' }
}
