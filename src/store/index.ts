import { create } from 'zustand'
import { getLocale } from '@/i18n'
import { lock, isBiometricAvailable } from '@/lib/commands'
import { createFlowSlice, type FlowSlice } from './flowSlice'
import { createGeneratorSlice, type GeneratorSlice } from './generatorSlice'
import { createFiltersSlice, type FiltersSlice } from './filtersSlice'
import { createEntriesSlice, type EntriesSlice } from './entriesSlice'
import { createAuditSlice, type AuditSlice } from './auditSlice'
import { createListSlice, type ListSlice } from './listSlice'
import { createSyncSlice, type SyncSlice } from './syncSlice'
import { createI18nSlice, type I18nSlice } from './i18nSlice'
import { createThemeSlice, type ThemeSlice } from './themeSlice'
import { createUpdateSlice, type UpdateSlice } from './updateSlice'
import { createUiSlice, type UiSlice } from './uiSlice'
import { createAsyncSlice, type AsyncSlice } from './thunks'

export type StoreState = FlowSlice &
  GeneratorSlice &
  FiltersSlice &
  EntriesSlice &
  AuditSlice &
  ListSlice &
  SyncSlice &
  I18nSlice &
  ThemeSlice &
  UpdateSlice &
  UiSlice &
  AsyncSlice

export const useStore = create<StoreState>()((...a) => ({
  ...createFlowSlice(...a),
  ...createGeneratorSlice(...a),
  ...createFiltersSlice(...a),
  ...createEntriesSlice(...a),
  ...createAuditSlice(...a),
  ...createListSlice(...a),
  ...createSyncSlice(...a),
  ...createI18nSlice(...a),
  ...createThemeSlice(...a),
  ...createUpdateSlice(...a),
  ...createUiSlice(...a),
  ...createAsyncSlice(...a)
}))

const pickData = (s: StoreState) => ({
  flow: s.flow,
  generator: s.generator,
  filters: s.filters,
  entries: s.entries,
  audit: s.audit,
  breachCheck: s.breachCheck,
  sync: s.sync,
  i18n: s.i18n,
  update: s.update,
  ui: s.ui
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
  openGenerator,
  closeGenerator,
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
  setSort,
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
  openPalette,
  closePalette,
  openSettings,
  closeSettings,
  runUpdateCheck,
  saveEntry,
  deleteEntry,
  enterMain,
  completeSetup,
  restoreBackup
} = useStore.getState()

// Manual lock, from anywhere (top chrome, Settings, palette): clear the session,
// then land on the lock screen with the Touch ID button when — and only when —
// a key is enrolled. Hardcoding `false` here is how the button used to vanish
// on every in-session lock. Autolock takes the same path via the vault:locked
// event (events.ts).
export const lockVault = () =>
  lock().finally(() =>
    isBiometricAvailable()
      .catch(() => false)
      .then(flowAuth)
  )
