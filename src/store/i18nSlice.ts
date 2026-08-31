import type { StateCreator } from 'zustand'
import { getLocale, setLocale } from '@/i18n'
import type { StoreState } from './index'

export interface I18nSlice {
  i18n: { locale: string }
  localeChanged: (locale: string) => void
}

export const createI18nSlice: StateCreator<StoreState, [], [], I18nSlice> = set => ({
  i18n: { locale: getLocale() },
  localeChanged: locale => {
    setLocale(locale)
    set({ i18n: { locale } })
  }
})
