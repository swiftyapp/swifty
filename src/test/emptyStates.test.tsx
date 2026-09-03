import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import Aside from '@/components/Main/Body/Aside'
import AuditList from '@/components/Main/Body/List/Audit'
import { makeStore, useStore, setFilterQuery, setFilterType, setView } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

// One empty-state system: the variant is decided from store state, and the
// list column and the detail pane never both claim the hero.
describe('empty states', () => {
  beforeEach(() => vi.clearAllMocks())

  const seed = (entries = [loginMeta({ id: 'l1', title: 'Google' })]) => {
    const store = makeStore()
    withEntries(entries)
    return store
  }

  describe('empty vault', () => {
    it('shows the hero once, in the detail pane, and opens the kind picker', async () => {
      renderWithStore(<Main />, { store: seed([]) })

      // Exactly one — the list column stays blank rather than repeating it.
      expect(screen.getAllByText('Your vault is empty')).toHaveLength(1)
      expect(
        screen.getByText(
          'Add your first login, card or note. Everything is encrypted before it touches disk.'
        )
      ).toBeInTheDocument()
      expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()

      await userEvent.click(screen.getByTestId('create-first-entry-button'))
      expect(useStore.getState().ui.addPicker).toBe(true)
    })

    it('offers the import route into Settings while Drive is not connected', async () => {
      renderWithStore(<Main />, { store: seed([]) })

      await userEvent.click(screen.getByText('Import from another app'))
      expect(useStore.getState().ui.settings).toBe(true)
      expect(screen.queryByText('Restore from Google Drive')).not.toBeInTheDocument()
    })

    it('swaps the secondary action for a Drive restore once sync is on', () => {
      const store = seed([])
      store.getState().syncInit(true)
      renderWithStore(<Main />, { store })

      expect(screen.getByText('Restore from Google Drive')).toBeInTheDocument()
      expect(screen.queryByText('Import from another app')).not.toBeInTheDocument()
    })
  })

  describe('kind filter with no items', () => {
    it('names the kind in the list column and starts one from the link', async () => {
      const store = seed()
      setFilterType('card')
      renderWithStore(<Main />, { store })

      expect(screen.getByText('No credit cards yet')).toBeInTheDocument()
      // The detail pane stays on the quiet state — no second hero.
      expect(screen.getByText('Select an item')).toBeInTheDocument()
      expect(screen.queryByText('Your vault is empty')).not.toBeInTheDocument()

      await userEvent.click(screen.getByText('Add a credit card'))
      expect(useStore.getState().entries.new).toBe('card')
    })
  })

  describe('search with no matches', () => {
    it('quotes the query back and clears it from the link', async () => {
      const store = seed()
      setFilterQuery('zzz')
      renderWithStore(<Main />, { store })

      expect(screen.getByText('No matches for “zzz”')).toBeInTheDocument()
      expect(screen.queryByText('Search all items')).not.toBeInTheDocument()

      await userEvent.click(screen.getByText('Clear search'))
      expect(useStore.getState().filters.query).toBe('')
    })

    it('names the kind filter as the other half of the why, and can widen', async () => {
      const store = seed()
      setFilterType('login')
      setFilterQuery('zzz')
      renderWithStore(<Main />, { store })

      expect(screen.getByText('No matches for “zzz” in logins')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Search all items'))
      expect(useStore.getState().filters.type).toBeNull()
    })
  })

  describe('nothing selected', () => {
    it('is quiet: hints, no body and no buttons', () => {
      renderWithStore(<Aside />, { store: seed() })

      expect(screen.getByText('Select an item')).toBeInTheDocument()
      expect(screen.getByText('↑↓')).toBeInTheDocument()
      expect(screen.getByText('browse')).toBeInTheDocument()
      expect(screen.getByText('⌘K')).toBeInTheDocument()
      // The hero treatment is reserved for the empty vault.
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('vault health with nothing to audit', () => {
    const healthStore = () => {
      const store = makeStore()
      withEntries([loginMeta({ id: 'l1', title: 'Google' })], {})
      setView('health')
      return store
    }

    it('explains the missing score and starts a login', async () => {
      renderWithStore(<Aside />, { store: healthStore() })

      expect(screen.getByText('Nothing to audit yet')).toBeInTheDocument()
      expect(
        screen.getByText('Your score appears once a login with a password is saved.')
      ).toBeInTheDocument()

      await userEvent.click(screen.getByText('Add a login'))
      expect(useStore.getState().entries.new).toBe('login')
    })

    it('leaves the audit column blank, and keeps the loading label until results', () => {
      const { unmount } = renderWithStore(<AuditList />, { store: healthStore() })
      expect(screen.queryByText('Loading Results..')).not.toBeInTheDocument()
      expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()
      unmount()

      const store = makeStore()
      withEntries([loginMeta({ id: 'l1', title: 'Google' })])
      setView('health')
      renderWithStore(<AuditList />, { store })
      expect(screen.getByText('Loading Results..')).toBeInTheDocument()
    })
  })
})
