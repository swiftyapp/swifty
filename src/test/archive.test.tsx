import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Body from '@/components/Main/Body'
import { useShortcuts } from '@/components/Main/useShortcuts'
import { useVault, selectCurrent, setView } from '@/store'
import { withEntries, deletedMeta, loginMeta } from './utils'
import { calls, mockCommand } from './ipc'

const NOW = new Date('2024-01-08T00:00:00.000Z')

const gone = deletedMeta({ id: 'gone', title: 'Old Account' })
const live = loginMeta({ id: 'live', title: 'Google' })

// ⌘E is an app-level accelerator (Main/useShortcuts), so the harness mounts it
// alongside the panes the way Main does — otherwise the guard under test would
// never be reached by a key press.
const Harness = () => {
  useShortcuts()
  return <Body />
}

// Open the Archive the way the rail does, and wait for `list_deleted` to land.
const openArchive = async (tombstones = [gone]) => {
  mockCommand('list_deleted', () => tombstones)
  withEntries([live])
  const rendered = render(<Harness />)
  setView('archive')
  await vi.waitFor(() => expect(useVault.getState().archive).toEqual(tombstones))
  return rendered
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => vi.useRealTimers())

describe('the Archive view', () => {
  it('lists the tombstones with when they went, not when they changed', async () => {
    await openArchive()

    expect(calls('list_deleted')).toHaveLength(1)
    expect(screen.getByTestId('list-title')).toHaveTextContent('Archive')
    expect(screen.getByTestId('entry-item-title')).toHaveTextContent('Old Account')
    expect(screen.getByText('Deleted 3d')).toBeInTheDocument()
    // The live entry belongs to All Items, not here.
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
  })

  it('offers Restore and a permanent delete instead of Edit, and reveals nothing', async () => {
    await openArchive()
    await userEvent.click(screen.getByTestId('entry-item'))

    expect(screen.getByTestId('restore-entry-button')).toBeInTheDocument()
    expect(screen.getByTestId('purge-entry-button')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-entry-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primary-action-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('more-actions-button')).not.toBeInTheDocument()
    // A deleted row has no readable payload, so nothing should even ask.
    expect(calls('reveal_entry')).toHaveLength(0)
  })

  it('restores an entry back into the live list and out of the Archive', async () => {
    mockCommand('restore_entry', () => loginMeta({ id: 'gone', title: 'Old Account' }))
    await openArchive()
    await userEvent.click(screen.getByTestId('entry-item'))

    await userEvent.click(screen.getByTestId('restore-entry-button'))

    expect(calls('restore_entry')).toContainEqual({ id: 'gone' })
    await vi.waitFor(() => {
      const state = useVault.getState()
      expect(state.items.map(e => e.id)).toEqual(['live', 'gone'])
      expect(state.archive).toEqual([])
      expect(selectCurrent(state)).toBeNull()
    })
  })

  it('needs two presses to delete permanently', async () => {
    await openArchive()
    await userEvent.click(screen.getByTestId('entry-item'))

    await userEvent.click(screen.getByTestId('purge-entry-button'))
    expect(calls('purge_entry')).toHaveLength(0)
    expect(screen.getByTestId('purge-entry-confirm')).toHaveTextContent('Delete forever?')

    await userEvent.click(screen.getByTestId('purge-entry-confirm'))

    expect(calls('purge_entry')).toContainEqual({ id: 'gone' })
    await vi.waitFor(() => expect(useVault.getState().archive).toEqual([]))
    // It does not come back as a live entry either.
    expect(useVault.getState().items.map(e => e.id)).toEqual(['live'])
  })

  // ⌘E and ⌘⏎ reach the entry without going through the detail header, so the
  // pane's read-only-ness has to hold at the store and service level too.
  it('refuses ⌘E on a tombstone, so no editor can open on an unreadable row', async () => {
    await openArchive()
    await userEvent.click(screen.getByTestId('entry-item'))

    await userEvent.keyboard('{Meta>}e{/Meta}')

    expect(useVault.getState().editing).toBe(false)
    expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument()
    // Still the read-only cluster, not an editor.
    expect(screen.getByTestId('restore-entry-button')).toBeInTheDocument()
  })

  it('still edits a live entry — the guard is about tombstones, not ⌘E', async () => {
    withEntries([live])
    render(<Harness />)

    await userEvent.click(screen.getByTestId('entry-item'))
    await userEvent.keyboard('{Meta>}e{/Meta}')

    expect(useVault.getState().editing).toBe(true)
  })

  it('fails quietly when ⌘⏎ asks a tombstone for its secret', async () => {
    mockCommand('reveal_entry', () => Promise.reject({ kind: 'notFound', message: 'entry not found' }))
    await openArchive()

    await userEvent.click(screen.getByTestId('search-input'))
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    // `reveal_entry` refuses deleted rows; the rejection must not escape
    // `copySecret`, and nothing may reach the clipboard.
    await vi.waitFor(() => expect(calls('reveal_entry')).toContainEqual({ id: 'gone' }))
    expect(calls('copy_to_clipboard')).toHaveLength(0)
  })

  it('shows the archive empty state when there is nothing to restore', async () => {
    await openArchive([])

    expect(screen.getByTestId('empty-archive')).toBeInTheDocument()
    expect(screen.getByText('Nothing archived yet')).toBeInTheDocument()
    expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()
  })

  it('survives a failed read of the tombstones', async () => {
    mockCommand('list_deleted', () => Promise.reject({ kind: 'io', message: 'vault busy' }))
    withEntries([live])
    render(<Harness />)

    setView('archive')
    await vi.waitFor(() => expect(calls('list_deleted').length).toBeGreaterThan(0))

    // No unhandled rejection, and the view still renders its own empty state.
    expect(screen.getByTestId('empty-archive')).toBeInTheDocument()
  })

  it('re-reads the tombstones on every visit, so a peer’s deletes show up', async () => {
    await openArchive()

    setView('items')
    setView('archive')

    await vi.waitFor(() => expect(calls('list_deleted')).toHaveLength(2))
  })
})
