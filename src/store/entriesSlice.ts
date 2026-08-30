import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Entry } from '@/lib/commands'
import { setFilterScope } from './filtersSlice'

interface EntriesState {
  new: boolean
  edit: boolean
  current: Entry | null
  items: Entry[]
}

const initialState: EntriesState = {
  new: false,
  edit: false,
  current: null,
  items: []
}

const find = (items: Entry[], id?: string) =>
  items.find(item => item.id === id) ?? null

const entriesSlice = createSlice({
  name: 'entries',
  initialState,
  reducers: {
    newEntry(state) {
      state.new = true
      state.edit = false
      state.current = null
    },
    setNoEntry(state) {
      state.new = false
      state.edit = false
      state.current = null
    },
    editEntry(state) {
      state.edit = true
      state.new = false
    },
    setEntries(state, action: PayloadAction<Entry[]>) {
      state.items = action.payload
    },
    setCurrentEntry(state, action: PayloadAction<string>) {
      state.current = find(state.items, action.payload)
      state.new = false
      state.edit = false
    },
    entrySaved(state, action: PayloadAction<string>) {
      state.edit = false
      state.new = false
      state.current = find(state.items, action.payload)
    },
    entryRemoved(state, action: PayloadAction<Entry[]>) {
      state.items = action.payload
      state.new = false
      state.edit = false
      state.current = null
    }
  },
  extraReducers: builder => {
    builder.addCase(setFilterScope, state => {
      state.new = false
      state.current = null
    })
  }
})

export const {
  newEntry,
  setNoEntry,
  editEntry,
  setEntries,
  setCurrentEntry,
  entrySaved,
  entryRemoved
} = entriesSlice.actions
export default entriesSlice.reducer
