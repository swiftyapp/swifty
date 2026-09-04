import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export type View = 'items' | 'favorites' | 'health' | 'archive'

// The Settings sections, in nav order.
export type Section = 'sync' | 'security' | 'audit' | 'import' | 'language'

/** Why a scan produced no fields. The copy for each lives in `Scan/Status`. */
export type ScanError = 'unreadable' | 'unsupported' | 'failed'

export interface UiSlice {
  ui: {
    palette: boolean
    settings: boolean
    settingsSection: Section
    addPicker: boolean
    view: View
    // Image scanning: whether the platform can do it at all (asked once per
    // unlock — no affordance is shown when it cannot), and the current run.
    scan: {
      supported: boolean
      busy: boolean
      error: ScanError | null
    }
  }
  setScanSupported: (supported: boolean) => void
  scanStarted: () => void
  scanFinished: (error?: ScanError | null) => void
  dismissScan: () => void
  openPalette: () => void
  closePalette: () => void
  openSettings: (section?: Section) => void
  closeSettings: () => void
  setSettingsSection: (section: Section) => void
  openAddPicker: () => void
  closeAddPicker: () => void
  setView: (view: View) => void
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set, get) => ({
  ui: {
    palette: false,
    settings: false,
    settingsSection: 'sync',
    addPicker: false,
    view: 'items',
    scan: { supported: false, busy: false, error: null }
  },
  setScanSupported: supported =>
    set(s => ({ ui: { ...s.ui, scan: { ...s.ui.scan, supported } } })),
  // A new run replaces the previous run's complaint: the user is answering it.
  scanStarted: () => set(s => ({ ui: { ...s.ui, scan: { ...s.ui.scan, busy: true, error: null } } })),
  scanFinished: error =>
    set(s => ({ ui: { ...s.ui, scan: { ...s.ui.scan, busy: false, error: error ?? null } } })),
  dismissScan: () => set(s => ({ ui: { ...s.ui, scan: { ...s.ui.scan, error: null } } })),
  openPalette: () => set(s => ({ ui: { ...s.ui, palette: true } })),
  closePalette: () => set(s => ({ ui: { ...s.ui, palette: false } })),
  // Without a section the modal reopens where it was left, so a deep link from
  // the palette is the only thing that moves it.
  openSettings: section =>
    set(s => ({
      ui: {
        ...s.ui,
        palette: false,
        settings: true,
        settingsSection: section ?? s.ui.settingsSection
      }
    })),
  closeSettings: () => set(s => ({ ui: { ...s.ui, settings: false } })),
  setSettingsSection: section => set(s => ({ ui: { ...s.ui, settingsSection: section } })),
  openAddPicker: () => set(s => ({ ui: { ...s.ui, palette: false, addPicker: true } })),
  closeAddPicker: () => set(s => ({ ui: { ...s.ui, addPicker: false } })),
  setView: view => {
    set(s => ({
      ui: { ...s.ui, view },
      entries: { ...s.entries, new: null, edit: false, current: null, prefill: null }
    }))
    // Tombstones are not part of the unlock payload, so the Archive reads them
    // when it is opened. Refetching on every visit is also what keeps it honest
    // after a sync merged a peer's deletes.
    if (view === 'archive') void get().loadArchive()
  }
})
