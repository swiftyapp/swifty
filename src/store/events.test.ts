import { describe, it, expect, beforeEach, vi } from 'vitest'
import { on, EVENTS, type EventName, type EventPayloads } from '@/lib/events'
import { getAudit } from '@/lib/commands'
import type { EntryMeta } from '@/lib/commands'
import { subscribeToEvents } from './events'
import { makeStore, setEntries } from './index'

const meta = (id: string): EntryMeta => ({
  id,
  type: 'login',
  title: id,
  tags: [],
  urlHost: ''
})

// The handler `subscribeToEvents` registered for one event. `on` is mocked
// globally (src/test/setup.ts), so the subscription is inspectable without a
// Tauri runtime.
const handlerFor = <E extends EventName>(event: E) => {
  const call = vi.mocked(on).mock.calls.find(([name]) => name === event)
  if (!call) throw new Error(`nothing subscribed to ${event}`)
  return call[1] as (payload: EventPayloads[E]) => void
}

beforeEach(() => {
  vi.clearAllMocks()
  makeStore()
  subscribeToEvents()
})

describe('vault:merged', () => {
  it('adopts the entries a sync pulled in from another device', () => {
    const store = makeStore()
    setEntries([meta('a')])
    subscribeToEvents()

    handlerFor(EVENTS.vaultMerged)({ entries: [meta('a'), meta('b')] })

    expect(store.getState().entries.items.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('re-runs the audit, since the new rows have no strength result yet', () => {
    handlerFor(EVENTS.vaultMerged)({ entries: [meta('b')] })
    expect(getAudit).toHaveBeenCalled()
  })
})

describe('sync:stopped', () => {
  it('surfaces the backend error for the sync indicator', () => {
    const store = makeStore()
    subscribeToEvents()

    handlerFor(EVENTS.syncStarted)()
    expect(store.getState().sync.inProgress).toBe(true)

    handlerFor(EVENTS.syncStopped)({ success: false, error: 'Drive API 403' })

    const { inProgress, success, error } = store.getState().sync
    expect(inProgress).toBe(false)
    expect(success).toBe(false)
    expect(error).toBe('Drive API 403')
  })
})
