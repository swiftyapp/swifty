import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import { copyToClipboard, revealEntry } from '@/lib/commands'
import { makeStore, useStore } from '@/store'
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

  it('opens the focused entry on ⏎, switching scope when needed', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'c1', title: 'Visa' }))
    renderWithStore(<Main />, { store: seed() })

    await open()
    await userEvent.keyboard('visa{Enter}')

    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    expect(useStore.getState().filters.scope).toBe('card')
    expect(useStore.getState().entries.current?.id).toBe('c1')
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
    // Commands: new entry · lock vault · toggle theme · settings
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

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
