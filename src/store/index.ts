import { create } from 'zustand'
import type { EntryType } from '@/api/types'
import { type SortMode, type Theme, type ThemePreference } from '@/api/app'
import { lock } from '@/api/auth'
import { resolveTheme } from '@/theme/apply'
import { createAppSlice, type AppSlice } from './appSlice'
import { createFlowSlice, type FlowSlice } from './flowSlice'
import { createGeneratorSlice, type GeneratorSlice } from './generatorSlice'
import { createFiltersSlice, type FiltersSlice } from './filtersSlice'
import { createEntriesSlice, type EntriesSlice } from './entriesSlice'
import { createAuditSlice, type AuditSlice } from './auditSlice'
import { createSettingsSlice, type SettingsSlice } from './settingsSlice'
import { createSyncSlice, type SyncSlice } from './syncSlice'
import { createUpdateSlice, type UpdateSlice } from './updateSlice'
import { createUiSlice, type UiSlice } from './uiSlice'
import { createShareSlice, type ShareSlice } from './shareSlice'
import { createSetupSlice, type SetupSlice } from './setupSlice'
import { createAsyncSlice, cancelScheduledSync, type AsyncSlice } from './thunks'

export type StoreState = AppSlice &
  FlowSlice &
  GeneratorSlice &
  FiltersSlice &
  EntriesSlice &
  AuditSlice &
  SettingsSlice &
  SyncSlice &
  UpdateSlice &
  UiSlice &
  ShareSlice &
  SetupSlice &
  AsyncSlice

export const useStore = create<StoreState>()((...a) => ({
  ...createAppSlice(...a),
  ...createFlowSlice(...a),
  ...createGeneratorSlice(...a),
  ...createFiltersSlice(...a),
  ...createEntriesSlice(...a),
  ...createAuditSlice(...a),
  ...createSettingsSlice(...a),
  ...createSyncSlice(...a),
  ...createUpdateSlice(...a),
  ...createUiSlice(...a),
  ...createShareSlice(...a),
  ...createSetupSlice(...a),
  ...createAsyncSlice(...a)
}))

const pickData = (s: StoreState) => ({
  app: s.app,
  flow: s.flow,
  generator: s.generator,
  filters: s.filters,
  entries: s.entries,
  audit: s.audit,
  sync: s.sync,
  update: s.update,
  ui: s.ui,
  share: s.share,
  setup: s.setup,
  // Hydrated from the backend at boot, so a test that changes a preference has
  // to have it put back like everything else.
  settings: s.settings
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
// this or any other vault) opens onto the previous one's rows. A share dialog
// goes with them: its link is live credentials, and it would otherwise still be
// on screen behind whoever unlocks next. Session-shaped state (flow, sync,
// settings, update) is deliberately kept.
export const resetVaultData = () => {
  const { entries, ui, filters, audit, share } = structuredClone(initialData)
  useStore.setState({ entries, ui, filters, audit, share })
  cancelScheduledSync()
}

// Actions never change reference, so we expose them bound for non-reactive use.
export const {
  setApp,
  refreshApp,
  flowSetup,
  flowAuth,
  flowMain,
  openGenerator,
  openSshGenerator,
  closeGenerator,
  setFilterQuery,
  setFilterType,
  setFilterTag,
  newEntry,
  setPrefill,
  clearPrefill,
  setNoEntry,
  editEntry,
  setEntries,
  setCurrentEntry,
  auditDone,
  runAudit,
  hydrateSettings,
  updateSettings,
  syncInit,
  syncPending,
  syncConnected,
  syncFailed,
  syncDisconnected,
  syncStart,
  syncStop,
  setUpdateReady,
  dismissUpdate,
  openPalette,
  closePalette,
  openSettings,
  closeSettings,
  setSettingsSection,
  openAddPicker,
  closeAddPicker,
  openSend,
  closeSend,
  openReceive,
  closeReceive,
  queueOrphan,
  dropOrphan,
  revokeOrphans,
  setView,
  showTag,
  flashCopied,
  setScanSupported,
  scanStarted,
  scanFinished,
  dismissScan,
  runUpdateCheck,
  saveEntry,
  deleteEntry,
  loadArchive,
  restoreEntry,
  purgeEntry,
  toggleFavorite,
  enterMain,
  setupCreate,
  restoreFromDrive,
  restoreBackup,
  setupDrivePending,
  setupDriveProbed,
  setupDriveFailed,
  setupDriveReset
} = useStore.getState()

// The named preferences, each a one-key patch. They read as what they do at the
// call site, and keep `updateSettings` the only way a preference is written.
export const changeTheme = (theme: ThemePreference) => updateSettings({ theme })

export const setSort = (listSort: SortMode) => updateSettings({ listSort })

export const setBreachCheck = (breachCheck: boolean) => updateSettings({ breachCheck })

// The palette command is a flip, so it resolves "system" first and then lands
// on a concrete light/dark preference.
export const toggleTheme = () => {
  const next: Theme =
    resolveTheme(useStore.getState().settings.theme) === 'dark' ? 'light' : 'dark'
  changeTheme(next)
}

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

// Land on the lock screen, behind a fresh probe: the screen draws its biometric
// button off `app.biometric` (App.tsx), and hardcoding that false is how the
// button used to vanish on every in-session lock. Both ways in — the manual
// lock below and autolock's `vault:locked` (events.ts) — come through here.
export const showLockScreen = () => refreshApp().then(() => flowAuth())

// Manual lock, from anywhere (top chrome, Settings, palette): clear the session,
// then back to the lock screen.
export const lockVault = () =>
  lock().finally(() => {
    resetVaultData()
    return showLockScreen()
  })
