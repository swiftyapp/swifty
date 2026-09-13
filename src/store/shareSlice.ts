import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

/**
 * Which share dialog is up, and nothing else.
 *
 * The link itself, the seal in flight and the error it may come back with are
 * the dialog's own business and live in its hook: they last exactly as long as
 * the dialog does, and nothing outside it can act on them. What the store owns
 * is only what other surfaces have to be able to say — the detail header's
 * "Share…", the kind picker's "Receive a shared secret…", a future palette
 * command — which is *open this*.
 */
export interface ShareSlice {
  share: {
    /** The entry being shared, or null when the send dialog is closed. */
    sendFor: string | null
    receiveOpen: boolean
  }
  openSend: (entryId: string) => void
  closeSend: () => void
  openReceive: () => void
  closeReceive: () => void
}

export const createShareSlice: StateCreator<StoreState, [], [], ShareSlice> = set => ({
  share: { sendFor: null, receiveOpen: false },
  openSend: entryId => set(s => ({ share: { ...s.share, sendFor: entryId } })),
  closeSend: () => set(s => ({ share: { ...s.share, sendFor: null } })),
  openReceive: () => set(s => ({ share: { ...s.share, receiveOpen: true } })),
  closeReceive: () => set(s => ({ share: { ...s.share, receiveOpen: false } }))
})
