import type { AppDispatch, RootState } from './index'
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
import { setEntries, entrySaved, entryRemoved } from './entriesSlice'
import { auditDone } from './auditSlice'
import { flowMain } from './flowSlice'
import { syncInit } from './syncSlice'
import { SYNC_ENABLED } from '@/config'

const trySync = () => {
  if (SYNC_ENABLED) syncNow().catch(() => {})
}

type Thunk = (dispatch: AppDispatch, getState: () => RootState) => Promise<void>

const now = () => new Date().toISOString()

const buildEntries = (
  draft: EntryDraft,
  items: Entry[]
): [Entry[], Entry] => {
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

const refreshAudit = (dispatch: AppDispatch) =>
  getAudit()
    .then(data => dispatch(auditDone(data)))
    .catch(() => {})

export const saveEntry =
  (draft: EntryDraft): Thunk =>
  async (dispatch, getState) => {
    const [entries, item] = buildEntries(draft, getState().entries.items)
    const vault = await saveVault(entries)
    dispatch(setEntries(vault.entries))
    dispatch(entrySaved(item.id))
    trySync()
    refreshAudit(dispatch)
  }

export const deleteEntry =
  (id: string): Thunk =>
  async (dispatch, getState) => {
    const remaining = getState().entries.items.filter(e => e.id !== id)
    const vault = await saveVault(remaining)
    dispatch(entryRemoved(vault.entries))
    trySync()
    refreshAudit(dispatch)
  }

export const enterMain =
  (result: UnlockResult): Thunk =>
  async dispatch => {
    await enlarge().catch(() => {})
    dispatch(setEntries(result.vault.entries))
    dispatch(flowMain())
    dispatch(syncInit(SYNC_ENABLED && result.syncConfigured))
    if (SYNC_ENABLED && result.syncConfigured) syncNow().catch(() => {})
  }

export const completeSetup =
  (password: string): Thunk =>
  async dispatch => {
    await setup(password)
    const vault = await readVault()
    await dispatch(enterMain({ vault, syncConfigured: false }))
  }

export const restoreBackup =
  (path: string, password: string): Thunk =>
  async dispatch => {
    const result = await importBackup(path, password)
    await dispatch(enterMain(result))
  }
