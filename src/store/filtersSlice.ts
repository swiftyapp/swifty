import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type Scope = 'login' | 'note' | 'card' | 'audit'

interface FiltersState {
  scope: Scope
  query: string
  tags: string[]
}

const initialState: FiltersState = { scope: 'login', query: '', tags: [] }

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilterQuery(state, action: PayloadAction<string>) {
      state.query = action.payload
    },
    setFilterScope(state, action: PayloadAction<Scope>) {
      state.scope = action.payload
    },
    setFilterTag(state, action: PayloadAction<string>) {
      state.tags = [action.payload]
    },
    unsetFilterTag(state) {
      state.tags = []
    }
  }
})

export const { setFilterQuery, setFilterScope, setFilterTag, unsetFilterTag } =
  filtersSlice.actions
export default filtersSlice.reducer
