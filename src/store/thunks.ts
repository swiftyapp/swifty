import type { StateCreator } from 'zustand'
import type { Entry, EntryMeta, UnlockResult } from '@/lib/commands'
import {
  saveEntry as saveEntryCmd,
  deleteEntry as deleteEntryCmd,
  listDeleted,
  restoreEntry as restoreEntryCmd,
  purgeEntry as purgeEntryCmd,
  setFavorite,
  getAudit,
  syncNow,
  setup,
  readVault,
  importBackup,
  setAutolockTimeout
} from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { getSecs } from '@/defaults/autolock'
import type { StoreState } from './index'

export interface AsyncSlice {
  saveEntry: (draft: EntryDraft) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  loadTrash: () => Promise<void>
  restoreEntry: (id: string) => Promise<void>
  purgeEntry: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  enterMain: (result: UnlockResult) => Promise<void>
  completeSetup: (password: string) => Promise<void>
  restoreBackup: (path: string, password: string) => Promise<void>
  runAudit: () => Promise<void>
}

/**
 * How long a write waits before it is published.
 *
 * A push is the whole vault, so firing one per keystroke-sized edit would send
 * the same snapshot over and over during a rename or a bulk import. The timer
 * resets on every write, so a burst costs exactly one push once it settles. The
 * debounce lives in the store rather than the backend because the backend has
 * no write hook — this is where "the user changed something" is known. A quit
 * inside the window loses nothing: the next unlock runs a sync anyway, and the
 * digests still differ until the change is published.
 */
const SYNC_DEBOUNCE_MS = 30_000

let syncTimer: ReturnType<typeof setTimeout> | undefined

// Drops a write waiting to be published. Called on lock: the backend has no key
// to push with any more, and the next unlock syncs anyway.
export const cancelScheduledSync = () => {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = undefined
}

const now = () => new Date().toISOString()

// Complete a draft into a full entry: existing entries keep their id/createdAt,
// new ones get a fresh id and timestamps. The backend restamps updatedAt on save.
const buildEntry = (draft: EntryDraft): Entry =>
  draft.id
    ? ({ ...draft, updatedAt: now() } as Entry)
    : ({ ...draft, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() } as Entry)

// Insert or replace one metadata row in the list, keeping it a fresh array.
const upsertMeta = (items: EntryMeta[], meta: EntryMeta): EntryMeta[] => {
  const next = items.slice()
  const index = next.findIndex(e => e.id === meta.id)
  if (index === -1) next.push(meta)
  else next[index] = meta
  return next
}

export const createAsyncSlice: StateCreator<StoreState, [], [], AsyncSlice> = (_set, get) => {
  const scheduleSync = () => {
    if (!get().sync.enabled) return
    cancelScheduledSync()
    syncTimer = setTimeout(() => {
      syncTimer = undefined
      syncNow().catch(() => {})
    }, SYNC_DEBOUNCE_MS)
  }

  // Restore and purge both take the row out of the Trash and leave nothing
  // selected: the detail pane must not keep showing a row this view no longer has.
  const dropFromTrash = (id: string) => {
    get().setTrash(get().entries.trash.filter(e => e.id !== id))
    get().setNoEntry()
  }

  const refreshAudit = () =>
    getAudit(get().breachCheck)
      .then(data => get().auditDone(data))
      .catch(() => {})

  return {
    runAudit: refreshAudit,
    saveEntry: async draft => {
      const entry = buildEntry(draft)
      const meta = await saveEntryCmd(entry)
      get().setEntries(upsertMeta(get().entries.items, meta))
      // A save always lands somewhere the user can see it: a type filter that
      // would hide the row just written is dropped rather than silently
      // swallowing it (the editor no longer takes its kind from the filter, so
      // the two can legitimately disagree).
      const { type } = get().filters
      if (type && type !== meta.type) get().setFilterType(null)
      get().setCurrentEntry(meta.id)
      scheduleSync()
      refreshAudit()
    },
    deleteEntry: async id => {
      await deleteEntryCmd(id)
      get().setEntries(get().entries.items.filter(e => e.id !== id))
      get().setNoEntry()
      scheduleSync()
      refreshAudit()
    },
    loadTrash: async () => {
      get().setTrash(await listDeleted())
    },
    restoreEntry: async id => {
      const meta = await restoreEntryCmd(id)
      get().setEntries(upsertMeta(get().entries.items, meta))
      dropFromTrash(id)
      scheduleSync()
      refreshAudit()
    },
    purgeEntry: async id => {
      await purgeEntryCmd(id)
      dropFromTrash(id)
      scheduleSync()
    },
    toggleFavorite: async id => {
      const entry = get().entries.items.find(e => e.id === id)
      if (!entry) return
      const meta = await setFavorite(id, !entry.favorite)
      get().setEntries(upsertMeta(get().entries.items, meta))
      // Un-starring inside Favorites drops the row out of the view, so keeping
      // it selected would leave the detail pane on an entry the list no longer
      // has (and hide the empty state).
      if (get().ui.view === 'favorites' && !meta.favorite) get().setNoEntry()
      else get().setCurrentEntry(meta.id)
      scheduleSync()
    },
    enterMain: async result => {
      get().setEntries(result.entries)
      get().flowMain()
      // The backend resets to its built-in default on every launch; re-apply
      // the stored preference as soon as there is a session to protect.
      setAutolockTimeout(getSecs()).catch(() => {})
      get().syncInit(result.syncConfigured)
      // One run on unlock: this device may have been off while another pushed,
      // and it may itself be holding writes a previous session never published.
      if (result.syncConfigured) syncNow().catch(() => {})
      refreshAudit()
    },
    completeSetup: async password => {
      await setup(password)
      const entries = await readVault()
      await get().enterMain({ entries, syncConfigured: false })
    },
    restoreBackup: async (path, password) => {
      const result = await importBackup(path, password)
      await get().enterMain(result)
    }
  }
}
