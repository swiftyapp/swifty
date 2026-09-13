import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

/**
 * Which share dialog is up, and which shares are waiting to be taken back.
 *
 * The link itself, the seal in flight and the error it may come back with are
 * the dialog's own business and live in its hook: they last exactly as long as
 * the dialog does, and nothing outside it can act on them. What the store owns
 * is what other surfaces have to be able to say — the detail header's
 * "Share…", the kind picker's "Receive a shared secret…" — and one thing that
 * has to outlive a dialog: a share whose link nobody saw.
 */
export interface ShareSlice {
  share: {
    /** The entry being shared, or null when the send dialog is closed. */
    sendFor: string | null
    receiveOpen: boolean
    /**
     * File ids of shares that were published after their dialog had moved on,
     * whose revoke has not yet succeeded. A seal that lands late is a live link
     * in the sender's Drive that no screen ever showed; it stays here until it
     * is taken back, and every share surface retries on the way in (see
     * `revokeOrphans`). Dropped with the rest of the vault state on lock: the
     * key needed to revoke is gone with it, and the share is still listed under
     * Shared links where it can be revoked by hand.
     */
    orphans: string[]
  }
  openSend: (entryId: string) => void
  closeSend: () => void
  openReceive: () => void
  closeReceive: () => void
  queueOrphan: (fileId: string) => void
  dropOrphan: (fileId: string) => void
}

export const createShareSlice: StateCreator<StoreState, [], [], ShareSlice> = set => ({
  share: { sendFor: null, receiveOpen: false, orphans: [] },
  openSend: entryId => set(s => ({ share: { ...s.share, sendFor: entryId } })),
  closeSend: () => set(s => ({ share: { ...s.share, sendFor: null } })),
  openReceive: () => set(s => ({ share: { ...s.share, receiveOpen: true } })),
  closeReceive: () => set(s => ({ share: { ...s.share, receiveOpen: false } })),
  queueOrphan: fileId =>
    set(s => ({
      share: {
        ...s.share,
        orphans: s.share.orphans.includes(fileId)
          ? s.share.orphans
          : [...s.share.orphans, fileId]
      }
    })),
  dropOrphan: fileId =>
    set(s => ({ share: { ...s.share, orphans: s.share.orphans.filter(id => id !== fileId) } }))
})
