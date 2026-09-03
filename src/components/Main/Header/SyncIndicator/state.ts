import type { TKey } from '@/i18n'
import type { StoreState } from '@/store'

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
   * The backend's own words, when it has any, shown verbatim in place of
   * `message`. A Drive API string is not a catalogue key, so looking one up
   * could only ever miss; keeping it a separate field is what lets `message`
   * stay honestly typed instead of casting an arbitrary string to `TKey`.
   */
  detail?: string
}

/**
 * The chip's five states, in priority order, from the sync slice.
 *
 * Ordering matters: a run in flight outranks the previous run's verdict, so a
 * retry after a failure reads as "syncing" rather than staying red until it
 * lands. `lastSyncedAt` -- not `success` -- is what promotes the chip to
 * "good": `success` starts optimistically true, so a vault connected a second
 * ago would otherwise claim to be up to date before a single run.
 */
export const syncView = (sync: StoreState['sync']): SyncView => {
  if (!sync.enabled)
    return { tone: 'local', message: 'Changes are saved on this device only' }
  if (sync.inProgress) return { tone: 'loading', message: 'Syncing…' }
  if (!sync.success)
    return {
      tone: 'bad',
      message: 'Something went wrong',
      detail: sync.error ?? undefined
    }
  // Connected, but nothing has landed yet. Deliberately not `loading`: if the
  // first run never starts, a spinner here would turn on at unlock and never
  // stop. A quiet cloud with no badge claims nothing instead.
  if (!sync.lastSyncedAt) return { tone: 'idle', message: 'Waiting to sync' }
  return { tone: 'good', message: 'Sync Successful' }
}
