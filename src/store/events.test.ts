import { describe, it, expect, beforeEach, vi } from 'vitest'
import { on, EVENTS, type EventName, type EventPayloads } from '@/lib/events'
import { getAudit, isBiometricAvailable, listDeleted } from '@/lib/commands'
import type { EntryMeta } from '@/lib/commands'
import { subscribeToEvents } from './events'
import {
  useApp,
  useUi,
  useVault,
  selectCurrent,
  setEntries,
  setArchive,
  setView,
  setCurrentEntry,
  flowMain,
  initialApp
} from './index'

const meta = (id: string): EntryMeta => ({
  id,
  type: 'login',
  title: id,
  tags: [],
  urlHost: '',
  favorite: false
})

const current = () => selectCurrent(useVault.getState())

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
  subscribeToEvents()
})

describe('vault:merged', () => {
  it('adopts the entries a sync pulled in from another device', () => {
    setEntries([meta('a')])

    handlerFor(EVENTS.vaultMerged)({ entries: [meta('a'), meta('b')] })

    expect(useVault.getState().items.map(e => e.id)).toEqual(['a', 'b'])
  })

  // The selection is an id, so the row it names is whatever the merged list
  // says it is now.
  it('reads the selected row from the merged list', () => {
    setEntries([meta('a')])
    setCurrentEntry('a')

    handlerFor(EVENTS.vaultMerged)({ entries: [{ ...meta('a'), title: 'Renamed' }] })

    expect(current()?.title).toBe('Renamed')
  })

  it('clears the selection when the merge dropped that row', () => {
    setEntries([meta('a'), meta('b')])
    setCurrentEntry('b')

    handlerFor(EVENTS.vaultMerged)({ entries: [meta('a')] })

    expect(useVault.getState().currentId).toBeNull()
    expect(current()).toBeNull()
  })

  it('re-runs the audit, since the new rows have no strength result yet', () => {
    handlerFor(EVENTS.vaultMerged)({ entries: [meta('b')] })
    expect(getAudit).toHaveBeenCalled()
  })

  // A merge can add or drop tombstones too, and the Archive only loads on entry
  // — so an open one has to be told, while a closed one refetches on its own.
  it('re-reads the tombstones when the Archive is the open view', () => {
    setView('archive')
    vi.mocked(listDeleted).mockClear()

    handlerFor(EVENTS.vaultMerged)({ entries: [meta('b')] })

    expect(listDeleted).toHaveBeenCalledTimes(1)
  })

  it('leaves the tombstones alone when the Archive is not open', () => {
    setView('items')
    vi.mocked(listDeleted).mockClear()

    handlerFor(EVENTS.vaultMerged)({ entries: [meta('b')] })

    expect(listDeleted).not.toHaveBeenCalled()
  })
})

// The backend owns sync — the consent flow, the runs, their outcome — and
// reports the whole of it on every change. The frontend stores it verbatim.
describe('sync:status', () => {
  it('is adopted as-is', () => {
    const status = {
      configured: true,
      pending: false,
      inProgress: false,
      error: 'Drive API 403',
      lastSyncedAt: '2024-01-01T00:00:00.000Z'
    }

    handlerFor(EVENTS.syncStatus)(status)

    expect(useApp.getState().sync).toEqual(status)
  })

  it('replaces the previous status rather than merging into it', () => {
    handlerFor(EVENTS.syncStatus)({ ...initialApp.sync, pending: true })
    handlerFor(EVENTS.syncStatus)({ ...initialApp.sync, configured: true })

    const { pending, configured } = useApp.getState().sync
    expect(pending).toBe(false)
    expect(configured).toBe(true)
  })
})

describe('vault:locked', () => {
  it('shows the Touch ID button when a key is enrolled, not a hardcoded false', async () => {
    vi.mocked(isBiometricAvailable).mockResolvedValue(true)
    flowMain()

    handlerFor(EVENTS.vaultLocked)()
    await vi.waitFor(() => expect(useApp.getState().flow).toBe('auth'))

    // The regression: this used to be `flowAuth(false)` unconditionally, so an
    // in-session lock (autolock, tray) never offered Touch ID again until a
    // full app restart.
    expect(useApp.getState().touchID).toBe(true)
  })

  it('drops the session data with the key', async () => {
    flowMain()
    setEntries([meta('a')])
    setArchive([meta('t')])
    setCurrentEntry('a')
    setView('archive')

    handlerFor(EVENTS.vaultLocked)()
    await vi.waitFor(() => expect(useApp.getState().flow).toBe('auth'))

    // Nothing of the unlocked vault survives the lock — the next unlock must
    // not open onto the previous session's rows.
    const vault = useVault.getState()
    expect(vault.items).toEqual([])
    expect(vault.archive).toEqual([])
    expect(vault.currentId).toBeNull()
    expect(useUi.getState().view).toBe('items')
  })

  it('lands on the plain lock screen when nothing is enrolled', async () => {
    vi.mocked(isBiometricAvailable).mockRejectedValue(new Error('no backend'))
    flowMain()

    handlerFor(EVENTS.vaultLocked)()
    await vi.waitFor(() => expect(useApp.getState().flow).toBe('auth'))
    expect(useApp.getState().touchID).toBe(false)
  })
})
