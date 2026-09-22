import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { EntryMeta, Workspace } from '@/api/types'
import { appStatusDefault, calls, mockCommand } from '../test/ipc'
import { resetStores } from '../test/utils'
import { subscribeToEvents } from './events'
import {
  useApp,
  useVault,
  setEntries,
  flowMain,
  switchWorkspace,
  createWorkspace
} from './index'

const meta = (id: string): EntryMeta =>
  ({ id, type: 'login', title: id, tags: [], urlHost: '', favorite: false })

const TWO: Workspace[] = [
  { id: 'default', name: null },
  { id: 'w2', name: 'Work' }
]

beforeEach(() => {
  vi.clearAllMocks()
  resetStores()
  // A switch is a lock, and a lock is an event: without the subscription the
  // app would never hear the one `workspace_select` emits.
  subscribeToEvents()
})

describe('switchWorkspace', () => {
  // The app is unlocked as a whole: Rust holds the other workspace's key and
  // opens it, answering like an unlock — the same landing as a create.
  it('opens the other workspace and drops the rows of the one left behind', async () => {
    flowMain()
    setEntries([meta('a')])
    mockCommand('workspace_select', () => ({ entries: [meta('b')], syncConfigured: false }))
    mockCommand('app_status', () => ({
      ...appStatusDefault(),
      workspaces: TWO,
      activeWorkspace: 'w2'
    }))

    await switchWorkspace('w2')

    expect(calls('workspace_select')).toEqual([{ id: 'w2' }])
    expect(calls('lock')).toHaveLength(0)
    expect(useApp.getState().flow).toBe('main')
    expect(useVault.getState().items.map(item => item.id)).toEqual(['b'])
    await vi.waitFor(() => expect(useApp.getState().status?.activeWorkspace).toBe('w2'))
  })

  // A workspace never opened with its password on this device: Rust has no key
  // for it, so the switch *is* a lock — announced like any other, and the one
  // `vault:locked` handler lands its lock screen.
  it('lands on the lock screen of a workspace the app holds no key for', async () => {
    flowMain()

    await switchWorkspace('w2')

    expect(calls('workspace_select')).toEqual([{ id: 'w2' }])
    expect(calls('lock')).toHaveLength(0)
    await vi.waitFor(() => expect(useApp.getState().flow).toBe('auth'))
  })
})

describe('createWorkspace', () => {
  it('opens the new workspace and drops the rows of the one left behind', async () => {
    setEntries([meta('a')])
    mockCommand('app_status', () => ({
      ...appStatusDefault(),
      workspaces: TWO,
      activeWorkspace: 'w2'
    }))

    await createWorkspace('Work', 'hunter2hunter2')

    expect(calls('workspace_create')).toEqual([{ name: 'Work', password: 'hunter2hunter2' }])
    expect(useApp.getState().flow).toBe('main')
    expect(useVault.getState().items).toEqual([])
    // The re-probe is what brings the new list on screen: creating is the one
    // move that changes which workspaces exist without passing through a lock.
    await vi.waitFor(() => expect(useApp.getState().status?.activeWorkspace).toBe('w2'))
  })

  it('reports a rejected create to the caller', async () => {
    mockCommand('workspace_create', () =>
      Promise.reject({ kind: 'other', message: 'name already taken' })
    )

    await expect(createWorkspace('Work', 'hunter2hunter2')).rejects.toMatchObject({
      message: 'name already taken'
    })
    expect(useApp.getState().flow).toBe('auth')
  })
})
