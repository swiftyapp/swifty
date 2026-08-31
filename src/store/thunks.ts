import type { StateCreator } from 'zustand'
import type { Entry, EntryMeta, UnlockResult } from '@/lib/commands'
import {
  saveEntry as saveEntryCmd,
  deleteEntry as deleteEntryCmd,
  getAudit,
  syncNow,
  setup,
  readVault,
  importBackup
} from '@/lib/commands'
import type { EntryDraft } from '@/defaults/entries'
import { enlarge } from '@/services/window'
import { SYNC_ENABLED } from '@/config'
import type { StoreState } from './index'

export interface AsyncSlice {
  saveEntry: (draft: EntryDraft) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  enterMain: (result: UnlockResult) => Promise<void>
  completeSetup: (password: string) => Promise<void>
  restoreBackup: (path: string, password: string) => Promise<void>
  runAudit: () => Promise<void>
}

const trySync = () => {
  if (SYNC_ENABLED) syncNow().catch(() => {})
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
      get().entrySaved(meta.id)
      trySync()
      refreshAudit()
    },
    deleteEntry: async id => {
      await deleteEntryCmd(id)
      get().entryRemoved(get().entries.items.filter(e => e.id !== id))
      trySync()
      refreshAudit()
    },
    enterMain: async result => {
      await enlarge().catch(() => {})
      get().setEntries(result.entries)
      get().flowMain()
      get().syncInit(SYNC_ENABLED && result.syncConfigured)
      if (SYNC_ENABLED && result.syncConfigured) syncNow().catch(() => {})
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
