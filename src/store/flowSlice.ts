import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type FlowName = 'setup' | 'auth' | 'main'

interface FlowState {
  name: FlowName
  touchID: boolean
}

// No backend command exists to detect a pristine vault, so we default to the
// auth screen (see PR report). Setup is reached explicitly via `flowSetup`.
const initialState: FlowState = { name: 'auth', touchID: false }

const flowSlice = createSlice({
  name: 'flow',
  initialState,
  reducers: {
    flowSetup(state) {
      state.name = 'setup'
    },
    flowAuth(state, action: PayloadAction<boolean>) {
      state.name = 'auth'
      state.touchID = action.payload
    },
    flowMain(state) {
      state.name = 'main'
    }
  }
})

export const { flowSetup, flowAuth, flowMain } = flowSlice.actions
export default flowSlice.reducer
