import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import { makeStore, useStore } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

const open = () => userEvent.keyboard('{Meta>}k{/Meta}')

const seed = () => {
  const store = makeStore()
  withEntries([
    loginMeta({ id: 'l1', title: 'Google', urlHost: 'google.com' }),
    loginMeta({ id: 'l2', title: 'Airbnb', urlHost: 'airbnb.com' }),
    { id: 'c1', type: 'card', title: 'Visa', tags: [], urlHost: '', favorite: false }
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

  it('lists every command before anything is typed', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()

    const palette = within(screen.getByTestId('command-palette'))
    expect(palette.getByText('Lock vault')).toBeInTheDocument()
    expect(palette.getByText('Settings')).toBeInTheDocument()
  })

  it('runs commands only — entries are the list column’s job', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()
    await userEvent.keyboard('google')

    // "Google" is in the vault and matches the query, but the palette does not
    // search entries; the list column behind it still does.
    const palette = within(screen.getByTestId('command-palette'))
    expect(palette.queryByText('Google')).not.toBeInTheDocument()
    expect(palette.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('ranks the matching commands, best first', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()
    await userEvent.keyboard('lock')

    const rows = screen.getAllByTestId('palette-item')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Lock vault')
  })

  it('runs the focused command on ⏎', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()
    await userEvent.keyboard('settings{Enter}')

    expect(useStore.getState().ui.settings).toBe(true)
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
  })

  it('moves focus with the arrow keys and runs the focused command', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()
    // Commands: new login · new credit card · new secure note · new identity ·
    // add a secret · lock vault · toggle theme · settings — seven moves down
    // from the first.
    await userEvent.keyboard(
      '{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}'
    )

    expect(useStore.getState().ui.settings).toBe(true)
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
  })

  // Focus never leaves the field, so the row the arrows land on is only
  // announced through aria-activedescendant.
  it('points the field at the focused row for a screen reader', async () => {
    renderWithStore(<Main />, { store: seed() })
    await open()

    const palette = within(screen.getByTestId('command-palette'))
    const field = screen.getByTestId('command-palette-input')
    const rows = screen.getAllByTestId('palette-item')
    expect(field).toHaveAttribute('aria-controls', palette.getByRole('listbox').id)
    expect(field).toHaveAttribute('aria-activedescendant', rows[0].id)

    await userEvent.keyboard('{ArrowDown}')

    expect(field).toHaveAttribute('aria-activedescendant', rows[1].id)
    expect(rows[1].id).not.toBe('')
  })

  it('runs a command on click', async () => {
    renderWithStore(<Main />, { store: seed() })
    const before = useStore.getState().theme

    await open()
    await userEvent.click(screen.getByText('Toggle theme'))

    expect(useStore.getState().theme).not.toBe(before)
  })
})
