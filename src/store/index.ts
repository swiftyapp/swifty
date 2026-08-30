import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'
import flow from './flowSlice'
import filters from './filtersSlice'
import entries from './entriesSlice'
import audit from './auditSlice'
import sync from './syncSlice'
import i18n from './i18nSlice'

export const makeStore = () =>
  configureStore({ reducer: { flow, filters, entries, audit, sync, i18n } })

export const store = makeStore()

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
