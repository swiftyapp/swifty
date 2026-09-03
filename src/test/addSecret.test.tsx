import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import { makeStore, useStore, setView } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

const seed = () => {
  const store = makeStore()
  withEntries([loginMeta({ id: 'l1', title: 'Google' })])
  return store
}

const openFromRail = () => userEvent.click(screen.getByTestId('add-entry-button'))
const modal = () => screen.queryByTestId('add-secret-modal')

beforeEach(() => vi.clearAllMocks())

describe('add a secret', () => {
  it('opens the picker from the rail button', async () => {
    renderWithStore(<Main />, { store: seed() })
    expect(modal()).not.toBeInTheDocument()

    await openFromRail()

    const dialog = screen.getByTestId('add-secret-modal')
    expect(dialog).toHaveAttribute('role', 'dialog')
    // The dialog is named by its own title, not a duplicated aria-label.
    expect(dialog).toHaveAccessibleName('Add a secret')
    // The rail button no longer starts an entry by itself.
    expect(useStore.getState().entries.new).toBeNull()
  })

  it('offers one tile per kind', async () => {
    renderWithStore(<Main />, { store: seed() })
    await openFromRail()

    const dialog = within(screen.getByTestId('add-secret-modal'))
    expect(dialog.getByTestId('add-kind-login')).toHaveTextContent('Login')
    expect(dialog.getByTestId('add-kind-card')).toHaveTextContent('Credit card')
    expect(dialog.getByTestId('add-kind-note')).toHaveTextContent('Secure note')
    expect(dialog.getByTestId('add-kind-identity')).toHaveTextContent('Identity')
    // Each tile also carries the kind's one-line description.
    expect(dialog.getByTestId('add-kind-login')).toHaveTextContent('Passwords for apps & sites')
  })

  it('starts an entry of the chosen kind and closes', async () => {
    renderWithStore(<Main />, { store: seed() })
    await openFromRail()

    await userEvent.click(screen.getByTestId('add-kind-card'))

    expect(useStore.getState().entries.new).toBe('card')
    expect(useStore.getState().ui.addPicker).toBe(false)
    expect(modal()).not.toBeInTheDocument()
  })

  it('focuses the first tile and moves focus with the arrow keys', async () => {
    renderWithStore(<Main />, { store: seed() })
    await openFromRail()

    expect(screen.getByTestId('add-kind-login')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByTestId('add-kind-card')).toHaveFocus()
    // Two columns: down from the second tile lands on the fourth.
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByTestId('add-kind-identity')).toHaveFocus()
    // And wraps from there back to the top of its own column.
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByTestId('add-kind-card')).toHaveFocus()
  })

  it('picks the nth kind by digit', async () => {
    renderWithStore(<Main />, { store: seed() })
    await openFromRail()

    await userEvent.keyboard('3')

    expect(useStore.getState().entries.new).toBe('note')
    expect(modal()).not.toBeInTheDocument()
  })

  it('closes on Escape without starting anything', async () => {
    renderWithStore(<Main />, { store: seed() })
    await openFromRail()

    await userEvent.keyboard('{Escape}')

    expect(modal()).not.toBeInTheDocument()
    expect(useStore.getState().entries.new).toBeNull()
  })

  it('opens on ⌘N', async () => {
    renderWithStore(<Main />, { store: seed() })

    await userEvent.keyboard('{Meta>}n{/Meta}')

    expect(screen.getByTestId('add-secret-modal')).toBeInTheDocument()
  })

  it('stays where it was when the picker is dismissed', async () => {
    renderWithStore(<Main />, { store: seed() })
    setView('trash')

    await openFromRail()
    await userEvent.keyboard('{Escape}')

    // Only committing to a kind leaves the view; asking does not.
    expect(useStore.getState().ui.view).toBe('trash')
  })

  it('leaves the health view so the new form has a list to land in', async () => {
    renderWithStore(<Main />, { store: seed() })
    setView('health')

    await openFromRail()
    await userEvent.click(screen.getByTestId('add-kind-login'))

    expect(useStore.getState().ui.view).toBe('items')
    expect(useStore.getState().entries.new).toBe('login')
  })

  it('is reachable from the empty detail pane', async () => {
    const store = makeStore()
    withEntries([])
    renderWithStore(<Main />, { store })

    const button = screen.getByTestId('create-first-entry-button')
    expect(button).toHaveTextContent('Add a secret')

    await userEvent.click(button)
    expect(screen.getByTestId('add-secret-modal')).toBeInTheDocument()
  })

  describe('from the palette', () => {
    const openPalette = () => userEvent.keyboard('{Meta>}k{/Meta}')

    it('lists a command per kind', async () => {
      renderWithStore(<Main />, { store: seed() })
      await openPalette()

      const palette = within(screen.getByTestId('command-palette'))
      // Each kind command is named the same way the editor sheet and the empty
      // panes name it, from the kind registry.
      expect(palette.getByText('Add a login')).toBeInTheDocument()
      expect(palette.getByText('Add a credit card')).toBeInTheDocument()
      expect(palette.getByText('Add a secure note')).toBeInTheDocument()
      expect(palette.getByText('Add a secret')).toBeInTheDocument()
    })

    it('starts the entry directly, without the picker', async () => {
      renderWithStore(<Main />, { store: seed() })
      await openPalette()

      // "Add a secure note" also names an empty-state action, so scope it.
      const palette = within(screen.getByTestId('command-palette'))
      await userEvent.click(palette.getByText('Add a secure note'))

      expect(useStore.getState().entries.new).toBe('note')
      expect(useStore.getState().ui.addPicker).toBe(false)
      expect(modal()).not.toBeInTheDocument()
    })

    it('opens the picker from "Add a secret"', async () => {
      renderWithStore(<Main />, { store: seed() })
      await openPalette()

      // The rail tooltip carries the same words, so scope to the palette.
      const palette = within(screen.getByTestId('command-palette'))
      await userEvent.click(palette.getByText('Add a secret'))

      expect(screen.getByTestId('add-secret-modal')).toBeInTheDocument()
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
      expect(useStore.getState().entries.new).toBeNull()
    })
  })
})
