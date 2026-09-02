import { describe, it, expect, beforeEach, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { subscribeToEvents } from '@/store/events'
import { on, EVENTS } from '@/lib/events'
import { isBiometricAvailable } from '@/lib/commands'
import { makeStore, flowMain } from '@/store'

beforeEach(() => vi.clearAllMocks())

// Digs the handler registered for an event out of the mocked `on`.
const handlerFor = (event: string) =>
  vi.mocked(on).mock.calls.find(([name]) => name === event)?.[1] as (
    payload?: unknown
  ) => void

describe('vault:locked', () => {
  it('returns to auth with Touch ID when biometrics are available', async () => {
    vi.mocked(isBiometricAvailable).mockResolvedValue(true)
    const store = makeStore()
    flowMain()
    subscribeToEvents()

    handlerFor(EVENTS.vaultLocked)()

    await waitFor(() =>
      expect(store.getState().flow).toEqual({ name: 'auth', touchID: true })
    )
  })

  it('returns to auth without Touch ID when the check fails', async () => {
    vi.mocked(isBiometricAvailable).mockRejectedValue(new Error('no backend'))
    const store = makeStore()
    flowMain()
    subscribeToEvents()

    handlerFor(EVENTS.vaultLocked)()

    await waitFor(() =>
      expect(store.getState().flow).toEqual({ name: 'auth', touchID: false })
    )
  })
})
