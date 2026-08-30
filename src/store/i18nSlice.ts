import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { getLocale, setLocale } from '@/i18n'

const i18nSlice = createSlice({
  name: 'i18n',
  initialState: { locale: getLocale() },
  reducers: {
    localeChanged(state, action: PayloadAction<string>) {
      setLocale(action.payload)
      state.locale = action.payload
    }
  }
})

export const { localeChanged } = i18nSlice.actions
export default i18nSlice.reducer
