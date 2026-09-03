import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  makeStore,
  setEntries,
  saveEntry,
  deleteEntry,
  enterMain,
  syncInit,
  setFilterType,
  lockVault
} from './index'
import { saveEntry as saveEntryCmd, toEntryMeta, syncNow } from '@/lib/commands'
import type { EntryMeta, Passkey } from '@/lib/commands'

const meta = (id: string, title = id): EntryMeta =>
  ({ id, type: 'login', title, tags: [], urlHost: '', favorite: false })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  makeStore()
  // Echo back the saved entry's metadata, as the real backend does.
  vi.mocked(saveEntryCmd).mockImplementation(entry => Promise.resolve(toEntryMeta(entry)))
})

afterEach(() => vi.useRealTimers())

describe('saveEntry', () => {
  it('creates a new entry and selects it', async () => {
    const store = makeStore()
    await saveEntry({ type: 'login', title: 'New', username: 'u', password: 'p' })

    const { items, current } = store.getState().entries
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('New')
    expect(current?.id).toBe(items[0].id)
    expect(saveEntryCmd).toHaveBeenCalledOnce()
    // Nothing to sync to: this vault is local-only.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('updates an existing entry', async () => {
    const store = makeStore()
    setEntries([meta('a', 'Old')])
    await saveEntry({ id: 'a', type: 'login', title: 'Updated', username: 'u', password: 'p' })

    const { items } = store.getState().entries
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Updated')
  })

  it('drops a kind filter that would hide the entry just saved', async () => {
    const store = makeStore()
    setFilterType('login')

    await saveEntry({
      type: 'card',
      title: 'Travel Card',
      number: '4111111111111111',
      month: '12',
      year: '30',
      cvc: '123'
    })

    // The row has to be visible for the selection to mean anything.
    expect(store.getState().filters.type).toBeNull()
    expect(store.getState().entries.current?.title).toBe('Travel Card')
  })

  it('keeps a kind filter the saved entry still matches', async () => {
    const store = makeStore()
    setFilterType('login')

    await saveEntry({ type: 'login', title: 'New', username: 'u', password: 'p' })

    expect(store.getState().filters.type).toBe('login')
    expect(store.getState().entries.current?.title).toBe('New')
  })

  // A draft spread from a revealed login carries its passkeys, and they reach
  // the backend untouched — while staying out of the list metadata.
  it('carries a login draft passkeys through to the backend', async () => {
    const store = makeStore()
    const passkeys: Passkey[] = [
      {
        credentialId: 'Y3JlZDE',
        rpId: 'acme.test',
        userHandle: 'dWgx',
        userName: 'alice',
        userDisplayName: 'Alice',
        privateKey: 'cGsx',
        counter: 0
      }
    ]

    await saveEntry({ type: 'login', title: 'Acme', username: 'u', password: 'p', passkeys })

    const saved = vi.mocked(saveEntryCmd).mock.calls[0][0]
    expect(saved.type === 'login' && saved.passkeys).toEqual(passkeys)
    expect(store.getState().entries.items[0]).not.toHaveProperty('passkeys')
  })
})

describe('auto-sync', () => {
  it('debounces a burst of writes into a single push', async () => {
    makeStore()
    syncInit(true)

    await saveEntry({ type: 'login', title: 'One', username: 'u', password: 'p' })
    await vi.advanceTimersByTimeAsync(20_000)
    await saveEntry({ type: 'login', title: 'Two', username: 'u', password: 'p' })

    // The second write reset the timer, so nothing has gone out yet.
    await vi.advanceTimersByTimeAsync(20_000)
    expect(syncNow).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(syncNow).toHaveBeenCalledOnce()
  })

  it('drops a write still waiting when the vault locks', async () => {
    makeStore()
    syncInit(true)

    await saveEntry({ type: 'login', title: 'One', username: 'u', password: 'p' })
    await lockVault()

    // The key is gone: a push fired now could only fail, and the next unlock
    // syncs anyway.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('publishes a delete too', async () => {
    makeStore()
    syncInit(true)
    setEntries([meta('a')])

    await deleteEntry('a')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(syncNow).toHaveBeenCalledOnce()
  })
})

describe('deleteEntry', () => {
  it('removes the entry and clears the selection', async () => {
    const store = makeStore()
    setEntries([meta('a'), meta('b')])
    await deleteEntry('a')

    const { items, current } = store.getState().entries
    expect(items.map(e => e.id)).toEqual(['b'])
    expect(current).toBeNull()
  })
})

describe('enterMain', () => {
  it('loads the vault and switches to the main flow', async () => {
    const store = makeStore()
    await enterMain({ entries: [meta('a')], syncConfigured: true })

    const state = store.getState()
    expect(state.flow.name).toBe('main')
    expect(state.entries.items.map(e => e.id)).toEqual(['a'])
    // A configured vault syncs once on unlock, before any local write.
    expect(state.sync.enabled).toBe(true)
    expect(syncNow).toHaveBeenCalledOnce()
  })

  it('leaves sync off for a vault that has never been connected', async () => {
    const store = makeStore()
    await enterMain({ entries: [], syncConfigured: false })

    expect(store.getState().sync.enabled).toBe(false)
    expect(syncNow).not.toHaveBeenCalled()
  })
})
