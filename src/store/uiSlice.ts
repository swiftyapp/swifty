import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

export type View = 'items' | 'favorites' | 'health' | 'trash'

// The Settings sections, in nav order.
export type Section = 'sync' | 'security' | 'audit' | 'import' | 'language'

export interface UiSlice {
  ui: {
    palette: boolean
    settings: boolean
    settingsSection: Section
    addPicker: boolean
    view: View
  }
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
    view: 'items'
  },
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
      entries: { ...s.entries, new: null, edit: false, current: null }
    }))
    // Tombstones are not part of the unlock payload, so the Trash reads them
    // when it is opened. Refetching on every visit is also what keeps it honest
    // after a sync merged a peer's deletes.
    if (view === 'trash') void get().loadTrash()
  }
})
