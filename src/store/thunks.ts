import type { StateCreator } from 'zustand'
import type { Entry, UnlockResult } from '@/lib/commands'
import {
  saveVault,
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
}

const trySync = () => {
  if (SYNC_ENABLED) syncNow().catch(() => {})
}

const now = () => new Date().toISOString()

const buildEntries = (draft: EntryDraft, items: Entry[]): [Entry[], Entry] => {
  const entries = items.slice()
  const index = entries.findIndex(e => e.id === draft.id)
  if (draft.id && index !== -1) {
    const updated = { ...draft, updatedAt: now() } as Entry
    entries[index] = updated
    return [entries, updated]
  }
  const created = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now()
  } as Entry
  entries.push(created)
  return [entries, created]
}

export const createAsyncSlice: StateCreator<StoreState, [], [], AsyncSlice> = (_set, get) => {
  const refreshAudit = () =>
    getAudit()
      .then(data => get().auditDone(data))
      .catch(() => {})

  return {
    saveEntry: async draft => {
      const [entries, item] = buildEntries(draft, get().entries.items)
      const vault = await saveVault(entries)
      get().setEntries(vault.entries)
      get().entrySaved(item.id)
      trySync()
      refreshAudit()
    },
    deleteEntry: async id => {
      const remaining = get().entries.items.filter(e => e.id !== id)
      const vault = await saveVault(remaining)
      get().entryRemoved(vault.entries)
      trySync()
      refreshAudit()
    },
    enterMain: async result => {
      await enlarge().catch(() => {})
      get().setEntries(result.vault.entries)
      get().flowMain()
      get().syncInit(SYNC_ENABLED && result.syncConfigured)
      if (SYNC_ENABLED && result.syncConfigured) syncNow().catch(() => {})
    },
    completeSetup: async password => {
      await setup(password)
      const vault = await readVault()
      await get().enterMain({ vault, syncConfigured: false })
    },
    restoreBackup: async (path, password) => {
      const result = await importBackup(path, password)
      await get().enterMain(result)
    }
  }
}
