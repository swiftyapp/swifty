import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeStore } from './index'
import { setEntries } from './entriesSlice'
import { saveEntry, deleteEntry, enterMain } from './thunks'
import { saveVault, syncNow } from '@/lib/commands'
import type { Entry } from '@/lib/commands'

const entry = (id: string, title = id): Entry =>
  ({ id, type: 'login', title, username: 'u', password: 'p', website: '', email: '', note: '', otp: '' }) as Entry

beforeEach(() => {
  vi.clearAllMocks()
  // Echo the plaintext entries back, as the real backend does after encrypting.
  vi.mocked(saveVault).mockImplementation(entries => Promise.resolve({ entries }))
})

describe('saveEntry', () => {
  it('creates a new entry and selects it', async () => {
    const store = makeStore()
    await store.dispatch(saveEntry({ type: 'login', title: 'New', username: 'u', password: 'p' }))

    const { items, current } = store.getState().entries
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('New')
    expect(current?.id).toBe(items[0].id)
    expect(saveVault).toHaveBeenCalledOnce()
    expect(syncNow).toHaveBeenCalledOnce()
  })

  it('updates an existing entry', async () => {
    const store = makeStore()
    store.dispatch(setEntries([entry('a', 'Old')]))
    await store.dispatch(saveEntry({ id: 'a', type: 'login', title: 'Updated', username: 'u', password: 'p' }))

    const { items } = store.getState().entries
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Updated')
  })
})

describe('deleteEntry', () => {
  it('removes the entry and clears the selection', async () => {
    const store = makeStore()
    store.dispatch(setEntries([entry('a'), entry('b')]))
    await store.dispatch(deleteEntry('a'))

    const { items, current } = store.getState().entries
    expect(items.map(e => e.id)).toEqual(['b'])
    expect(current).toBeNull()
  })
})

describe('enterMain', () => {
  it('loads the vault and switches to the main flow', async () => {
    const store = makeStore()
    await store.dispatch(enterMain({ vault: { entries: [entry('a')] }, syncConfigured: true }))

    const state = store.getState()
    expect(state.flow.name).toBe('main')
    expect(state.entries.items.map(e => e.id)).toEqual(['a'])
    expect(state.sync.enabled).toBe(true)
    expect(syncNow).toHaveBeenCalledOnce()
  })
})
