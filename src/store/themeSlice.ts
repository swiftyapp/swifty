import type { StateCreator } from 'zustand'
import { getTheme, setTheme, resolveTheme, type Theme, type ThemePreference } from '@/theme'
import type { StoreState } from './index'

export interface ThemeSlice {
  theme: ThemePreference
  changeTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
}

export const createThemeSlice: StateCreator<StoreState, [], [], ThemeSlice> = (
  set,
  get
) => ({
  theme: getTheme(),
  changeTheme: theme => {
    setTheme(theme)
    set({ theme })
  },
  // The palette command is a flip, so it resolves "system" first and then lands
  // on a concrete light/dark preference.
  toggleTheme: () => {
    const next: Theme = resolveTheme(get().theme) === 'dark' ? 'light' : 'dark'
    setTheme(next)
    set({ theme: next })
  }
})
