import { create } from 'zustand'
import type { EntryType } from '@/api/types'
import { appStatus, type AppStatus } from '@/api/app'
import { lock } from '@/api/auth'
import { workspaceCreate, workspaceSelect } from '@/api/workspace'
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
import { createShareSlice, type ShareSlice } from './shareSlice'
import { createSetupSlice, type SetupSlice } from './setupSlice'
import { createWorkspaceSlice, type WorkspaceSlice } from './workspaceSlice'
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
  ShareSlice &
  SetupSlice &
  WorkspaceSlice &
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
  ...createShareSlice(...a),
  ...createSetupSlice(...a),
  ...createWorkspaceSlice(...a),
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
  share: s.share,
  setup: s.setup,
  workspaces: s.workspaces,
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
// this or any other vault) opens onto the previous one's rows. A share dialog
// goes with them: its link is live credentials, and it would otherwise still be
// on screen behind whoever unlocks next. Session-shaped state (flow, sync,
// theme, locale, update) is deliberately kept.
export const resetVaultData = () => {
  const { entries, ui, filters, audit, share } = structuredClone(initialData)
  useStore.setState({ entries, ui, filters, audit, share })
  cancelScheduledSync()
}

// Actions never change reference, so we expose them bound for non-reactive use.
export const {
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
  setBreachCheck,
  runAudit,
  setSort,
  syncInit,
  syncPending,
  syncConnected,
  syncFailed,
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
  openSend,
  closeSend,
  openReceive,
  closeReceive,
  queueOrphan,
  dropOrphan,
  revokeOrphans,
  setView,
  showTag,
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
  setupDriveReset,
  setWorkspaces
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
    // Which gate it is comes along for the ride: the lock screen names it, and
    // which workspaces exist comes with it so the screen can offer the others.
    return appStatus()
      .then(status => {
        applyWorkspaces(status)
        flowAuth(status.biometric.available, status.biometric.type)
      })
      .catch(() => flowAuth(false))
  })

// The workspace list off a probe already in hand (launch, a lock), so neither
// has to ask twice for one answer.
export const applyWorkspaces = ({ workspaces, activeWorkspace }: AppStatus) =>
  setWorkspaces(workspaces, activeWorkspace)

// Ask again where nothing else was being probed for: after a rename or a
// create, which are the two things that change the list from inside the app.
export const refreshWorkspaces = () => appStatus().then(applyWorkspaces)

// Move to another workspace. Only one is ever unlocked, so this is a lock:
// mark the other active, then take the ordinary lock path, which lands on that
// workspace's lock screen with the picker still offering the way back.
export const switchWorkspace = (id: string) => workspaceSelect(id).then(lockVault)

// Create a workspace and open it. It arrives active and unlocked, so this is an
// unlock rather than a first run — but of a different database, so the session
// data of the one being left has to go first, exactly as a lock would drop it.
export const createWorkspace = async (name: string, password: string) => {
  const result = await workspaceCreate(name, password)
  resetVaultData()
  // A failed re-read leaves a stale list, not a broken session; the new
  // workspace is open either way.
  await refreshWorkspaces().catch(() => {})
  await enterMain(result)
}
