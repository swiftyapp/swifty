import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Body from '@/components/Main/Body'
import { useShortcuts } from '@/components/Main/useShortcuts'
import {
  copyToClipboard,
  listDeleted,
  purgeEntry,
  restoreEntry,
  revealEntry
} from '@/lib/commands'
import { makeStore, useStore, setView } from '@/store'
import { renderWithStore, withEntries, deletedMeta, loginMeta } from './utils'

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

// Open the Trash the way the rail does, and wait for `list_deleted` to land.
const openTrash = async (tombstones = [gone]) => {
  vi.mocked(listDeleted).mockResolvedValue(tombstones)
  const store = makeStore()
  withEntries(store, [live])
  const rendered = renderWithStore(<Harness />, { store })
  setView('trash')
  await vi.waitFor(() => expect(useStore.getState().entries.trash).toEqual(tombstones))
  return rendered
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => vi.useRealTimers())

describe('the Trash view', () => {
  it('lists the tombstones with when they went, not when they changed', async () => {
    await openTrash()

    expect(listDeleted).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('list-title')).toHaveTextContent('Trash')
    expect(screen.getByTestId('entry-item-title')).toHaveTextContent('Old Account')
    expect(screen.getByText('Deleted 3d')).toBeInTheDocument()
    // The live entry belongs to All Items, not here.
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
  })

  it('offers Restore and a permanent delete instead of Edit, and reveals nothing', async () => {
    await openTrash()
    await userEvent.click(screen.getByTestId('entry-item'))

    expect(screen.getByTestId('restore-entry-button')).toBeInTheDocument()
    expect(screen.getByTestId('purge-entry-button')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-entry-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('primary-action-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('more-actions-button')).not.toBeInTheDocument()
    // A deleted row has no readable payload, so nothing should even ask.
    expect(revealEntry).not.toHaveBeenCalled()
  })

  it('restores an entry back into the live list and out of the Trash', async () => {
    vi.mocked(restoreEntry).mockResolvedValue(loginMeta({ id: 'gone', title: 'Old Account' }))
    await openTrash()
    await userEvent.click(screen.getByTestId('entry-item'))

    await userEvent.click(screen.getByTestId('restore-entry-button'))

    expect(restoreEntry).toHaveBeenCalledWith('gone')
    await vi.waitFor(() => {
      const { items, trash, current } = useStore.getState().entries
      expect(items.map(e => e.id)).toEqual(['live', 'gone'])
      expect(trash).toEqual([])
      expect(current).toBeNull()
    })
  })

  it('needs two presses to delete permanently', async () => {
    await openTrash()
    await userEvent.click(screen.getByTestId('entry-item'))

    await userEvent.click(screen.getByTestId('purge-entry-button'))
    expect(purgeEntry).not.toHaveBeenCalled()
    expect(screen.getByTestId('purge-entry-confirm')).toHaveTextContent('Delete forever?')

    await userEvent.click(screen.getByTestId('purge-entry-confirm'))

    expect(purgeEntry).toHaveBeenCalledWith('gone')
    await vi.waitFor(() => expect(useStore.getState().entries.trash).toEqual([]))
    // It does not come back as a live entry either.
    expect(useStore.getState().entries.items.map(e => e.id)).toEqual(['live'])
  })

  // ⌘E and ⌘⏎ reach the entry without going through the detail header, so the
  // pane's read-only-ness has to hold at the store and service level too.
  it('refuses ⌘E on a tombstone, so no editor can open on an unreadable row', async () => {
    await openTrash()
    await userEvent.click(screen.getByTestId('entry-item'))

    await userEvent.keyboard('{Meta>}e{/Meta}')

    expect(useStore.getState().entries.edit).toBe(false)
    expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument()
    // Still the read-only cluster, not an editor.
    expect(screen.getByTestId('restore-entry-button')).toBeInTheDocument()
  })

  it('still edits a live entry — the guard is about tombstones, not ⌘E', async () => {
    const store = makeStore()
    withEntries(store, [live])
    renderWithStore(<Harness />, { store })

    await userEvent.click(screen.getByTestId('entry-item'))
    await userEvent.keyboard('{Meta>}e{/Meta}')

    expect(useStore.getState().entries.edit).toBe(true)
  })

  it('fails quietly when ⌘⏎ asks a tombstone for its secret', async () => {
    vi.mocked(revealEntry).mockRejectedValue(new Error('entry not found'))
    await openTrash()

    await userEvent.click(screen.getByTestId('search-input'))
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    // `reveal_entry` refuses deleted rows; the rejection must not escape
    // `copySecret`, and nothing may reach the clipboard.
    await vi.waitFor(() => expect(revealEntry).toHaveBeenCalledWith('gone'))
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('shows the trash empty state when there is nothing to restore', async () => {
    await openTrash([])

    expect(screen.getByTestId('empty-trash')).toBeInTheDocument()
    expect(screen.getByText('Nothing in the trash')).toBeInTheDocument()
    expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()
  })

  it('re-reads the tombstones on every visit, so a peer’s deletes show up', async () => {
    await openTrash()

    setView('items')
    setView('trash')

    await vi.waitFor(() => expect(listDeleted).toHaveBeenCalledTimes(2))
  })
})
