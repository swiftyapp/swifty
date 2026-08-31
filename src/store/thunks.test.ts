import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeStore, setEntries, saveEntry, deleteEntry, enterMain } from './index'
import { saveEntry as saveEntryCmd, toEntryMeta, syncNow } from '@/lib/commands'
import type { EntryMeta } from '@/lib/commands'

const meta = (id: string, title = id): EntryMeta => ({ id, type: 'login', title, tags: [], urlHost: '' })

beforeEach(() => {
  vi.clearAllMocks()
  makeStore()
  // Echo back the saved entry's metadata, as the real backend does.
  vi.mocked(saveEntryCmd).mockImplementation(entry => Promise.resolve(toEntryMeta(entry)))
})

describe('saveEntry', () => {
  it('creates a new entry and selects it', async () => {
    const store = makeStore()
    await saveEntry({ type: 'login', title: 'New', username: 'u', password: 'p' })

    const { items, current } = store.getState().entries
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('New')
    expect(current?.id).toBe(items[0].id)
    expect(saveEntryCmd).toHaveBeenCalledOnce()
    // Sync is disabled for now, so saving must not trigger it.
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
    // Sync is disabled for now: never enabled, never triggered on unlock.
    expect(state.sync.enabled).toBe(false)
    expect(syncNow).not.toHaveBeenCalled()
  })
})
