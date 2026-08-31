import { create } from 'zustand'
import { getLocale } from '@/i18n'
import { createFlowSlice, type FlowSlice } from './flowSlice'
import { createFiltersSlice, type FiltersSlice } from './filtersSlice'
import { createEntriesSlice, type EntriesSlice } from './entriesSlice'
import { createAuditSlice, type AuditSlice } from './auditSlice'
import { createSyncSlice, type SyncSlice } from './syncSlice'
import { createI18nSlice, type I18nSlice } from './i18nSlice'
import { createThemeSlice, type ThemeSlice } from './themeSlice'
import { createUpdateSlice, type UpdateSlice } from './updateSlice'
import { createAsyncSlice, type AsyncSlice } from './thunks'

export type StoreState = FlowSlice &
  FiltersSlice &
  EntriesSlice &
  AuditSlice &
  SyncSlice &
  I18nSlice &
  ThemeSlice &
  UpdateSlice &
  AsyncSlice

export const useStore = create<StoreState>()((...a) => ({
  ...createFlowSlice(...a),
  ...createFiltersSlice(...a),
  ...createEntriesSlice(...a),
  ...createAuditSlice(...a),
  ...createSyncSlice(...a),
  ...createI18nSlice(...a),
  ...createThemeSlice(...a),
  ...createUpdateSlice(...a),
  ...createAsyncSlice(...a)
}))

const pickData = (s: StoreState) => ({
  flow: s.flow,
  filters: s.filters,
  entries: s.entries,
  audit: s.audit,
  breachCheck: s.breachCheck,
  sync: s.sync,
  i18n: s.i18n,
  update: s.update
})

const initialData = pickData(useStore.getState())

// Resets the (singleton) store to its initial state. Tests call this to isolate
// state between runs; `false` merges so the action functions are preserved.
export const makeStore = () => {
  useStore.setState({ ...structuredClone(initialData), i18n: { locale: getLocale() } }, false)
  return useStore
}

// Actions never change reference, so we expose them bound for non-reactive use.
export const {
  flowSetup,
  flowAuth,
  flowMain,
  setFilterQuery,
  setFilterScope,
  setFilterTag,
  unsetFilterTag,
  newEntry,
  setNoEntry,
  editEntry,
  setEntries,
  setCurrentEntry,
  entrySaved,
  entryRemoved,
  auditDone,
  setBreachCheck,
  runAudit,
  syncInit,
  syncConnected,
  syncDisconnected,
  syncStart,
  syncStop,
  localeChanged,
  changeTheme,
  toggleTheme,
  setUpdateReady,
  dismissUpdate,
  runUpdateCheck,
  saveEntry,
  deleteEntry,
  enterMain,
  completeSetup,
  restoreBackup
} = useStore.getState()
