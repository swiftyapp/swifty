import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import type { EntryMeta } from '@/lib/commands'
import { revealEntry } from '@/lib/commands'
import { makeStore, useStore } from '@/store'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

const note = (id: string, title: string): EntryMeta =>
  ({ id, type: 'note', title, tags: [], urlHost: '', favorite: false })
const card = (id: string, title: string): EntryMeta =>
  ({ id, type: 'card', title, tags: [], urlHost: '', favorite: false })

beforeEach(() => vi.clearAllMocks())

describe('Main', () => {
  const seed = () => {
    const store = makeStore()
    withEntries([loginMeta({ id: 'l1', title: 'Google' }), note('n1', 'Journal'), card('c1', 'Visa')])
    return store
  }

  it('lists every kind together by default', () => {
    renderWithStore(<Main />, { store: seed() })
    // "All Items" is the landing view now — one flat, mixed-kind list.
    expect(screen.getByTestId('list-title')).toHaveTextContent('All Items')
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Journal')).toBeInTheDocument()
    expect(screen.getByText('Visa')).toBeInTheDocument()
    expect(screen.getAllByTestId('entry-item')).toHaveLength(3)
  })

  it('selects an entry and shows its details', async () => {
    // Details are revealed (decrypted) on demand for the selected entry.
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'l1', title: 'Google' }))
    renderWithStore(<Main />, { store: seed() })
    await userEvent.click(screen.getByText('Google'))
    expect(screen.getByRole('heading', { name: 'Google' })).toBeInTheDocument()
    // email only appears in the details pane, not the list row
    expect(await screen.findByText('contact@example.com')).toBeInTheDocument()
  })

  it('filters entries by search query', async () => {
    const store = makeStore()
    withEntries([loginMeta({ id: 'a', title: 'Airbnb' }), loginMeta({ id: 'g', title: 'Google' })])
    renderWithStore(<Main />, { store })

    await userEvent.type(screen.getByPlaceholderText('Search'), 'air')
    expect(screen.getByText('Airbnb')).toBeInTheDocument()
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
  })

  it('focuses the one search field on ⌘F', async () => {
    renderWithStore(<Main />, { store: seed() })
    expect(screen.getAllByTestId('search-input')).toHaveLength(1)

    await userEvent.keyboard('{Meta>}f{/Meta}')
    expect(screen.getByTestId('search-input')).toHaveFocus()
  })

  it('edits the selected entry on ⌘E, and needs a selection to do it', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'l1', title: 'Google' }))
    renderWithStore(<Main />, { store: seed() })

    // Nothing selected: the chord has nothing to edit.
    await userEvent.keyboard('{Meta>}e{/Meta}')
    expect(useStore.getState().entries.edit).toBe(false)

    await userEvent.click(screen.getByText('Google'))
    await userEvent.keyboard('{Meta>}e{/Meta}')
    expect(useStore.getState().entries.edit).toBe(true)
  })

  // jsdom implements no `inert` semantics, so the attribute itself is the
  // assertion: it is what takes the column's rows, chips and arrows out of the
  // browser's keyboard and pointer reach while a draft is open.
  it('takes the list column out of the keyboard while a draft is open', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'l1', title: 'Google' }))
    renderWithStore(<Main />, { store: seed() })

    const column = screen.getByTestId('list-column')
    expect(column).not.toHaveAttribute('inert')

    await userEvent.click(screen.getByText('Google'))
    await userEvent.keyboard('{Meta>}e{/Meta}')
    expect(useStore.getState().entries.edit).toBe(true)

    expect(column).toHaveAttribute('inert')
    // `pointer-events-none` only ever stopped the mouse.
    expect(column.className).not.toContain('pointer-events-none')
  })

  it('narrows the list to one kind through the filter chips', async () => {
    renderWithStore(<Main />, { store: seed() })

    await userEvent.click(screen.getByTestId('filter-note'))
    expect(screen.getByText('Journal')).toBeInTheDocument()
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
    expect(screen.queryByText('Visa')).not.toBeInTheDocument()
    // The title follows the filter, and the chip reports itself pressed.
    expect(screen.getByTestId('list-title')).toHaveTextContent('Secure notes')
    expect(screen.getByTestId('filter-note')).toHaveAttribute('aria-pressed', 'true')

    // "All" puts everything back.
    await userEvent.click(screen.getByTestId('filter-all'))
    expect(screen.getAllByTestId('entry-item')).toHaveLength(3)
  })

  it('counts each kind on its chip', () => {
    renderWithStore(<Main />, { store: seed() })

    const count = (testid: string) =>
      screen.getByTestId(testid).querySelector('.font-mono')?.textContent

    expect(count('filter-all')).toBe('3')
    expect(count('filter-login')).toBe('1')
    expect(count('filter-card')).toBe('1')
    expect(count('filter-note')).toBe('1')
  })

  it('switches to the vault health view from the rail and back', async () => {
    renderWithStore(<Main />, { store: seed() })

    await userEvent.click(screen.getByTestId('view-health'))
    expect(screen.getByTestId('list-title')).toHaveTextContent('Vault Health')
    // Neither chip row applies to the audit.
    expect(screen.queryByTestId('kinds-list')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('view-items'))
    expect(screen.getByTestId('list-title')).toHaveTextContent('All Items')
    expect(screen.getAllByTestId('entry-item')).toHaveLength(3)
  })

  it('keeps the selected entry when the kind filter still admits it', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'l1', title: 'Google' }))
    renderWithStore(<Main />, { store: seed() })

    await userEvent.click(screen.getByText('Google'))
    expect(useStore.getState().entries.current?.id).toBe('l1')

    // Narrowing to the kind you are already reading must not close it.
    await userEvent.click(screen.getByTestId('filter-login'))
    expect(useStore.getState().entries.current?.id).toBe('l1')

    // Narrowing to a kind that would hide it does clear the selection.
    await userEvent.click(screen.getByTestId('filter-card'))
    expect(useStore.getState().entries.current).toBeNull()
  })

  it('shows the empty-vault hero in the detail pane when there are no entries', () => {
    const store = makeStore()
    withEntries([])
    renderWithStore(<Main />, { store })
    expect(screen.getByText('Your vault is empty')).toBeInTheDocument()
    expect(screen.getByTestId('create-first-entry-button')).toBeInTheDocument()
  })
})
