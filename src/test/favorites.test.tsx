import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '@/components/Main/Sidebar'
import ListColumn from '@/components/Main/Body/ListColumn'
import Body from '@/components/Main/Body'
import Show from '@/components/Main/Body/Aside/Show'
import { revealEntry, setFavorite } from '@/lib/commands'
import { makeStore, useStore, setView, setSort, setCurrentEntry } from '@/store'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

const starred = loginMeta({ id: 'star', title: 'Monzo', favorite: true })
const plain = loginMeta({ id: 'plain', title: 'Airbnb' })

const titles = () => screen.getAllByTestId('entry-item-title').map(el => el.textContent)

const seed = () => {
  const store = makeStore()
  withEntries(store, [plain, starred])
  return store
}

beforeEach(() => {
  vi.clearAllMocks()
  setSort('recent')
})

describe('the favorite toggle', () => {
  it('stars an unstarred entry and keeps the new value in the list', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'plain' }))
    renderWithStore(<Show entry={plain} />, { store: seed() })

    await userEvent.click(screen.getByTestId('favorite-toggle'))

    expect(setFavorite).toHaveBeenCalledWith('plain', true)
    await vi.waitFor(() =>
      expect(useStore.getState().entries.items.find(e => e.id === 'plain')?.favorite).toBe(true)
    )
  })

  it('unstars an entry that is already starred', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'star' }))
    renderWithStore(<Show entry={starred} />, { store: seed() })

    await userEvent.click(screen.getByTestId('favorite-toggle'))

    expect(setFavorite).toHaveBeenCalledWith('star', false)
  })

  it('is absent for a trashed entry — a tombstone cannot be starred', () => {
    renderWithStore(<Show entry={loginMeta({ deletedAt: '2024-02-01T00:00:00.000Z' })} />)
    expect(screen.queryByTestId('favorite-toggle')).not.toBeInTheDocument()
  })
})

describe('the Favorites view', () => {
  it('sits between All Items and Vault Health in the rail', () => {
    renderWithStore(<Sidebar />)

    const rail = screen.getAllByRole('button').map(b => b.getAttribute('data-testid'))
    expect(rail).toEqual([
      'add-entry-button',
      'view-items',
      'view-favorites',
      'view-health',
      'view-trash',
      'settings-button'
    ])
  })

  it('lists only the starred entries and titles the column after itself', () => {
    const store = seed()
    setView('favorites')
    renderWithStore(<ListColumn />, { store })

    expect(titles()).toEqual(['Monzo'])
    expect(screen.getByTestId('list-title')).toHaveTextContent('Favorites')
  })

  it('marks starred rows with a star in every view', () => {
    renderWithStore(<ListColumn />, { store: seed() })

    expect(screen.getAllByTestId('entry-item-star')).toHaveLength(1)
  })

  it('pins favorites above the rest under recency, and leaves alphabetical alone', async () => {
    // `plain` is the more recently touched of the two, so recency alone would
    // put it first: only the pin can float the starred row over it.
    const store = makeStore()
    withEntries(store, [
      loginMeta({ id: 'plain', title: 'Airbnb', updatedAt: '2024-03-01T00:00:00.000Z' }),
      loginMeta({ id: 'star', title: 'Monzo', favorite: true, updatedAt: '2024-01-01T00:00:00.000Z' })
    ])
    renderWithStore(<ListColumn />, { store })

    expect(titles()).toEqual(['Monzo', 'Airbnb'])

    await userEvent.click(screen.getByTestId('sort-menu'))
    await userEvent.click(screen.getByText('Alphabetical'))
    expect(titles()).toEqual(['Airbnb', 'Monzo'])
  })

  it('says how to fill itself when nothing is starred', () => {
    const store = makeStore()
    withEntries(store, [plain])
    setView('favorites')
    renderWithStore(<Body />, { store })

    expect(screen.getByTestId('empty-favorites')).toBeInTheDocument()
    expect(screen.getByText('Star an entry to keep it here.')).toBeInTheDocument()
    expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()
  })

  it('drops the selection when the shown entry is unstarred from inside it', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'star' }))
    const store = makeStore()
    withEntries(store, [starred])
    setView('favorites')
    setCurrentEntry('star')
    renderWithStore(<Body />, { store })

    await userEvent.click(screen.getByTestId('favorite-toggle'))

    await vi.waitFor(() => expect(useStore.getState().entries.current).toBeNull())
    expect(screen.getByTestId('empty-favorites')).toBeInTheDocument()
  })
})
