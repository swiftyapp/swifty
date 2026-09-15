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
  syncPending
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
    handlerFor(EVENTS.pullStopped)({ success: true })

    expect(listDeleted).not.toHaveBeenCalled()
  })
})

describe('sync:stopped', () => {
  it('surfaces the backend error for the sync indicator', () => {
    handlerFor(EVENTS.syncStarted)()
    expect(useApp.getState().sync.inProgress).toBe(true)

    handlerFor(EVENTS.syncStopped)({ success: false, error: 'Drive API 403' })

    const { inProgress, success, error } = useApp.getState().sync
    expect(inProgress).toBe(false)
    expect(success).toBe(false)
    expect(error).toBe('Drive API 403')
  })
})

// The backend owns the consent flow: `sync:pending` when it opens the browser,
// then exactly one of `sync:connected` / `sync:error`. The frontend only mirrors.
describe('the pending connect', () => {
  it('is started by sync:pending', () => {
    handlerFor(EVENTS.syncPending)()
    expect(useApp.getState().sync.pending).toBe(true)
  })

  it('is finished by sync:connected', () => {
    handlerFor(EVENTS.syncPending)()
    expect(useApp.getState().sync.pending).toBe(true)

    handlerFor(EVENTS.syncConnected)()

    const { pending, enabled, error } = useApp.getState().sync
    expect(pending).toBe(false)
    expect(enabled).toBe(true)
    expect(error).toBeNull()
  })

  it('is finished by sync:error, which leaves the vault unconnected', () => {
    syncPending()

    handlerFor(EVENTS.syncError)({ error: 'access_denied' })

    const { pending, enabled, error } = useApp.getState().sync
    expect(pending).toBe(false)
    expect(enabled).toBe(false)
    expect(error).toBe('access_denied')
  })

  it('clears a previous failure when the user tries again', () => {
    handlerFor(EVENTS.syncError)({ error: 'access_denied' })

    syncPending()

    expect(useApp.getState().sync.error).toBeNull()
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
