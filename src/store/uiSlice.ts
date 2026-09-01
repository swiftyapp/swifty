import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

// Chrome-level UI surfaces that more than one component needs to open: the ⌘K
// command palette and the Settings modal. Keeping them here means any control
// (rail button, header field, palette command) can open one with a bound action
// instead of prop-drilling or lifting state through the three-pane shell.
export interface UiSlice {
  ui: { palette: boolean; settings: boolean }
  openPalette: () => void
  closePalette: () => void
  openSettings: () => void
  closeSettings: () => void
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = set => ({
  ui: { palette: false, settings: false },
  openPalette: () => set(s => ({ ui: { ...s.ui, palette: true } })),
  closePalette: () => set(s => ({ ui: { ...s.ui, palette: false } })),
  // Opening Settings dismisses the palette, so a palette command can hand off.
  openSettings: () => set(() => ({ ui: { palette: false, settings: true } })),
  closeSettings: () => set(s => ({ ui: { ...s.ui, settings: false } }))
})
