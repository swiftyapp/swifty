import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

// Which top-level surface the two content panes are showing. This is the app's
// only navigation axis now — the entry kinds are a filter within `items`, not
// destinations of their own.
export type View = 'items' | 'health'

// Chrome-level UI surfaces that more than one component needs to open: the ⌘K
// command palette, the Settings modal and the "Add a secret" kind picker.
// Keeping them here means any control (rail button, header field, palette
// command) can open one with a bound action instead of prop-drilling or lifting
// state through the three-pane shell.
export interface UiSlice {
  ui: { palette: boolean; settings: boolean; addPicker: boolean; view: View }
  openPalette: () => void
  closePalette: () => void
  openSettings: () => void
  closeSettings: () => void
  openAddPicker: () => void
  closeAddPicker: () => void
  setView: (view: View) => void
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = set => ({
  ui: { palette: false, settings: false, addPicker: false, view: 'items' },
  openPalette: () => set(s => ({ ui: { ...s.ui, palette: true } })),
  closePalette: () => set(s => ({ ui: { ...s.ui, palette: false } })),
  // Opening Settings dismisses the palette, so a palette command can hand off.
  openSettings: () => set(s => ({ ui: { ...s.ui, palette: false, settings: true } })),
  closeSettings: () => set(s => ({ ui: { ...s.ui, settings: false } })),
  // Same hand-off for the kind picker: the palette's "Add a secret" opens it.
  openAddPicker: () => set(s => ({ ui: { ...s.ui, palette: false, addPicker: true } })),
  closeAddPicker: () => set(s => ({ ui: { ...s.ui, addPicker: false } })),
  // The panes are shared between views, so anything selected or half-written
  // under the old one would otherwise bleed through.
  setView: view =>
    set(s => ({
      ui: { ...s.ui, view },
      entries: { ...s.entries, new: null, edit: false, current: null }
    }))
})
