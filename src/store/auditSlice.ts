import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Audit } from '@/lib/commands'

const auditSlice = createSlice({
  name: 'audit',
  initialState: null as Audit | null,
  reducers: {
    auditDone(_state, action: PayloadAction<Audit>) {
      return action.payload
    }
  }
})

export const { auditDone } = auditSlice.actions
export default auditSlice.reducer
