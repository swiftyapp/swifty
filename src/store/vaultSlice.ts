import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Entry, VaultData } from '../lib/commands'

interface VaultState {
  locked: boolean
  entries: Entry[]
  syncConfigured: boolean
}

const initialState: VaultState = {
  locked: true,
  entries: [],
  syncConfigured: false
}

const vaultSlice = createSlice({
  name: 'vault',
  initialState,
  reducers: {
    unlocked(state, action: PayloadAction<VaultData>) {
      state.locked = false
      state.entries = action.payload.entries
    },
    locked(state) {
      state.locked = true
      state.entries = []
    },
    syncConfigured(state, action: PayloadAction<boolean>) {
      state.syncConfigured = action.payload
    }
  }
})

export const { unlocked, locked, syncConfigured } = vaultSlice.actions
export default vaultSlice.reducer
