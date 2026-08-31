import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import type { EntryMeta } from '@/lib/commands'
import { revealEntry } from '@/lib/commands'
import { makeStore } from '@/store'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

const note = (id: string, title: string): EntryMeta =>
  ({ id, type: 'note', title, tags: [], urlHost: '' })
const card = (id: string, title: string): EntryMeta =>
  ({ id, type: 'card', title, tags: [], urlHost: '' })

beforeEach(() => vi.clearAllMocks())

describe('Main', () => {
  const seed = () => {
    const store = makeStore()
    withEntries(store, [loginMeta({ id: 'l1', title: 'Google' }), note('n1', 'Journal'), card('c1', 'Visa')])
    return store
  }

  it('lists logins for the default scope', () => {
    renderWithStore(<Main />, { store: seed() })
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.queryByText('Journal')).not.toBeInTheDocument()
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
    withEntries(store, [loginMeta({ id: 'a', title: 'Airbnb' }), loginMeta({ id: 'g', title: 'Google' })])
    renderWithStore(<Main />, { store })

    await userEvent.type(screen.getByPlaceholderText('Search'), 'air')
    expect(screen.getByText('Airbnb')).toBeInTheDocument()
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
  })

  it('switches scope to notes', async () => {
    const { container } = renderWithStore(<Main />, { store: seed() })
    // switcher items are ordered: login, note, card
    const noteItem = container.querySelectorAll('.switcher .item')[1]
    await userEvent.click(noteItem)
    expect(screen.getByText('Journal')).toBeInTheDocument()
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
  })

  it('shows the empty placeholder when there are no entries', () => {
    const store = makeStore()
    withEntries(store, [])
    renderWithStore(<Main />, { store })
    expect(screen.getByText('No Items')).toBeInTheDocument()
  })
})
