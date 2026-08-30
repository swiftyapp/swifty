import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface SyncState {
  enabled: boolean
  inProgress: boolean
  success: boolean
  error: string | null
}

const initialState: SyncState = {
  enabled: false,
  inProgress: false,
  success: true,
  error: null
}

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    syncInit(state, action: PayloadAction<boolean>) {
      state.enabled = action.payload
    },
    syncConnected(state) {
      state.enabled = true
      state.success = true
      state.error = null
    },
    syncDisconnected(state) {
      state.enabled = false
    },
    syncStart(state) {
      state.inProgress = true
      state.success = true
      state.error = null
    },
    syncStop(
      state,
      action: PayloadAction<{ success: boolean; error?: string }>
    ) {
      state.inProgress = false
      state.success = action.payload.success
      state.error = action.payload.error ?? null
    }
  }
})

export const {
  syncInit,
  syncConnected,
  syncDisconnected,
  syncStart,
  syncStop
} = syncSlice.actions
export default syncSlice.reducer
