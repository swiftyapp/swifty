import type { StateCreator } from 'zustand'
import { getTheme, setTheme, type Theme } from '@/theme'
import type { StoreState } from './index'

export interface ThemeSlice {
  theme: Theme
  changeTheme: (theme: Theme) => void
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
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    set({ theme: next })
  }
})
