import { create } from 'zustand'
import { lock, isBiometricAvailable, type EntryType } from '@/lib/commands'
import { createFlowSlice, type FlowSlice } from './flowSlice'
import { createGeneratorSlice, type GeneratorSlice } from './generatorSlice'
import { createFiltersSlice, type FiltersSlice } from './filtersSlice'
import { createEntriesSlice, type EntriesSlice } from './entriesSlice'
import { createAuditSlice, type AuditSlice } from './auditSlice'
import { createListSlice, type ListSlice } from './listSlice'
import { createSyncSlice, type SyncSlice } from './syncSlice'
import { createThemeSlice, type ThemeSlice } from './themeSlice'
import { createUpdateSlice, type UpdateSlice } from './updateSlice'
import { createUiSlice, type UiSlice } from './uiSlice'
import { createAsyncSlice, cancelScheduledSync, type AsyncSlice } from './thunks'

export type StoreState = FlowSlice &
  GeneratorSlice &
  FiltersSlice &
  EntriesSlice &
  AuditSlice &
  ListSlice &
  SyncSlice &
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
  update: s.update,
  ui: s.ui,
  // Both read a persisted preference at slice creation, so a test that changes
  // one has to have it put back like everything else.
  sort: s.sort,
  theme: s.theme
})

const initialData = pickData(useStore.getState())

// Resets the (singleton) store to its initial state. Tests call this to isolate
// state between runs; `false` merges so the action functions are preserved.
export const makeStore = () => {
  useStore.setState(structuredClone(initialData), false)
  return useStore
}

// Everything the unlocked session put in the store: the entry list and what is
// selected in it, the surfaces open over it, and the audit of it. A lock has to
// drop all of it — it outlives the session otherwise, and the next unlock (of
// this or any other vault) opens onto the previous one's rows. Session-shaped
// state (flow, sync, theme, locale, update) is deliberately kept.
export const resetVaultData = () => {
  const { entries, ui, filters, audit } = structuredClone(initialData)
  useStore.setState({ entries, ui, filters, audit })
  cancelScheduledSync()
}

// Actions never change reference, so we expose them bound for non-reactive use.
export const {
  flowSetup,
  flowAuth,
  flowMain,
  openGenerator,
  closeGenerator,
  setFilterQuery,
  setFilterType,
  newEntry,
  setPrefill,
  clearPrefill,
  setNoEntry,
  editEntry,
  setEntries,
  setCurrentEntry,
  auditDone,
  setBreachCheck,
  runAudit,
  setSort,
  syncInit,
  syncConnected,
  syncDisconnected,
  syncStart,
  syncStop,
  changeTheme,
  toggleTheme,
  setUpdateReady,
  dismissUpdate,
  openPalette,
  closePalette,
  openSettings,
  closeSettings,
  setSettingsSection,
  openAddPicker,
  closeAddPicker,
  setView,
  setScanSupported,
  scanStarted,
  scanFinished,
  dismissScan,
  runUpdateCheck,
  saveEntry,
  deleteEntry,
  loadTrash,
  restoreEntry,
  purgeEntry,
  toggleFavorite,
  enterMain,
  completeSetup,
  restoreBackup
} = useStore.getState()

// Starts a new entry of `type` from anywhere (kind picker, palette command,
// a scan), leaving the audit view first — it has no editor to land the form in.
// `setView` clears any half-written draft, so it has to run before `newEntry`.
// `prefill` seeds the fields a scan already read (see `Scan/run`).
export const startEntry = (type: EntryType, prefill?: Record<string, string>) => {
  // Only All Items can hold a draft: every other view is a filtered or
  // read-only surface the new entry would immediately fall out of.
  if (useStore.getState().ui.view !== 'items') setView('items')
  newEntry(type, prefill)
}

// Manual lock, from anywhere (top chrome, Settings, palette): clear the session,
// then land on the lock screen with the Touch ID button when — and only when —
// a key is enrolled. Hardcoding `false` here is how the button used to vanish
// on every in-session lock. Autolock takes the same path via the vault:locked
// event (events.ts).
export const lockVault = () =>
  lock().finally(() => {
    resetVaultData()
    return isBiometricAvailable()
      .catch(() => false)
      .then(flowAuth)
  })
