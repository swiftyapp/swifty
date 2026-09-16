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
  it('marks the other active and lands on its lock screen', async () => {
    flowMain()

    await switchWorkspace('w2')

    expect(calls('workspace_select')).toEqual([{ id: 'w2' }])
    // Only one workspace is unlocked at a time, so the switch *is* the lock:
    // Rust clears the session inside `workspace_select` and announces it like
    // any other, and the one `vault:locked` handler lands the screen.
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
