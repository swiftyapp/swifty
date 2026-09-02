import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import { copyToClipboard, revealEntry } from '@/lib/commands'
import { makeStore, useStore, setFilterType, setView } from '@/store'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

const open = () => userEvent.keyboard('{Meta>}k{/Meta}')

const seed = () => {
  const store = makeStore()
  withEntries(store, [
    loginMeta({ id: 'l1', title: 'Google', urlHost: 'google.com' }),
    loginMeta({ id: 'l2', title: 'Airbnb', urlHost: 'airbnb.com' }),
    { id: 'c1', type: 'card', title: 'Visa', tags: [], urlHost: '' }
  ])
  return store
}

beforeEach(() => vi.clearAllMocks())

describe('command palette', () => {
  it('opens on ⌘K and closes on Escape', async () => {
    renderWithStore(<Main />, { store: seed() })
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()

    await open()
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
  })

  it('lists commands before anything is typed', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()

    expect(screen.getByText('Commands')).toBeInTheDocument()
    expect(screen.getByText('Lock vault')).toBeInTheDocument()
    expect(screen.queryByText('Best match')).not.toBeInTheDocument()
  })

  it('filters entries as you type, best match first', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()
    await userEvent.keyboard('goo')

    // The list column behind the palette shows entries too, so scope the query.
    const palette = within(screen.getByTestId('command-palette'))
    expect(palette.getByText('Best match')).toBeInTheDocument()
    expect(palette.getByText('Google')).toBeInTheDocument()
    expect(palette.queryByText('Airbnb')).not.toBeInTheDocument()
  })

  it('opens the focused entry on ⏎', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'c1', title: 'Visa' }))
    renderWithStore(<Main />, { store: seed() })

    await open()
    await userEvent.keyboard('visa{Enter}')

    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    // Opening a result never narrows the list — it just selects.
    expect(useStore.getState().filters.type).toBeNull()
    expect(useStore.getState().entries.current?.id).toBe('c1')
  })

  it('clears a kind filter that would hide the opened result', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'c1', title: 'Visa' }))
    renderWithStore(<Main />, { store: seed() })

    // Filtered to logins, but the palette searches the whole vault.
    setFilterType('login')

    await open()
    await userEvent.keyboard('visa{Enter}')

    expect(useStore.getState().filters.type).toBeNull()
    expect(useStore.getState().entries.current?.id).toBe('c1')
    // With the filter gone the card is back in the list, selected.
    expect(screen.getAllByTestId('entry-item')).toHaveLength(3)
  })

  it('leaves the health view when a result is opened from it', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'l1', title: 'Google' }))
    renderWithStore(<Main />, { store: seed() })
    setView('health')

    await open()
    await userEvent.keyboard('google{Enter}')

    expect(useStore.getState().ui.view).toBe('items')
    expect(useStore.getState().entries.current?.id).toBe('l1')
  })

  it('copies the primary secret on ⌘⏎', async () => {
    vi.mocked(revealEntry).mockResolvedValue(
      loginEntry({ id: 'l1', title: 'Google', password: 's3cret' })
    )
    renderWithStore(<Main />, { store: seed() })

    await open()
    await userEvent.keyboard('google{Meta>}{Enter}{/Meta}')

    expect(revealEntry).toHaveBeenCalledWith('l1')
    await vi.waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith('s3cret', expect.anything()))
    // The entry is copied, not selected.
    expect(useStore.getState().entries.current).toBeNull()
  })

  it('moves focus with the arrow keys and runs the focused command', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()
    // Commands: add a login · add a credit card · add a secure note · add a
    // secret · lock vault · toggle theme · settings — six moves down.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

    expect(useStore.getState().ui.settings).toBe(true)
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
  })

  it('runs a command on click', async () => {
    const store = seed()
    renderWithStore(<Main />, { store })
    const before = useStore.getState().theme

    await open()
    await userEvent.click(screen.getByText('Toggle theme'))

    expect(useStore.getState().theme).not.toBe(before)
  })
})
