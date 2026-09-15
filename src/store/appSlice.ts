import type { StateCreator } from 'zustand'
import { appStatus, type AppStatus } from '@/api/app'
import type { StoreState } from './index'

export interface AppSlice {
  /**
   * The launch probe's last answer, in one place. It was eight `app_status`
   * calls racing each other — one per screen that wanted a leaf of it — so
   * every screen now reads this instead and re-renders when it is refreshed.
   *
   * Null until the boot probe lands (`main.tsx`), and on a host where that call
   * failed outright; every reader treats that as "nothing known yet".
   */
  app: AppStatus | null
  /** Take the boot probe's answer wholesale (see `main.tsx`). */
  setApp: (status: AppStatus) => void
  /**
   * Ask again, after something that can change the answer: an unlock, a lock,
   * an enrollment. Resolves with what it stored — or null, keeping the last
   * known answer, if the call failed — and never rejects, so no caller has to
   * guard it.
   */
  refreshApp: () => Promise<AppStatus | null>
}

export const createAppSlice: StateCreator<StoreState, [], [], AppSlice> = set => ({
  app: null,
  setApp: app => set({ app }),
  refreshApp: () =>
    appStatus()
      .then(app => {
        set({ app })
        return app
      })
      .catch(() => null)
})
