import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from '@/components/Main/Header'
import { makeStore } from '@/store'
import { renderWithStore } from './utils'

beforeEach(() => vi.clearAllMocks())

// A store with sync configured, seeded before render (the store is a singleton,
// so mutating it after mount would need an act() wrapper for no gain).
const connected = () => {
  const store = makeStore()
  store.getState().syncConnected()
  return store
}

describe('Header', () => {
  it('hides the sync pill until sync is configured', () => {
    renderWithStore(<Header />)
    expect(screen.queryByTestId('sync-indicator')).not.toBeInTheDocument()
    // Lock stays: it is the one control the chrome always owns.
    expect(screen.getByTestId('lock-vault-button')).toBeInTheDocument()
  })

  it('shows the sync pill once sync is configured', () => {
    renderWithStore(<Header />, { store: connected() })
    expect(screen.getByTestId('sync-indicator')).toHaveTextContent('Synced')
  })

  it('reports a failed sync on the pill', () => {
    const store = connected()
    store.getState().syncStop({ success: false, error: 'Drive said no' })
    renderWithStore(<Header />, { store })
    expect(screen.getByTestId('sync-indicator')).toHaveTextContent('Sync error')
  })

  it('opens Settings › Sync & devices from the sync pill', async () => {
    const { store } = renderWithStore(<Header />, { store: connected() })

    await userEvent.click(screen.getByTestId('sync-indicator'))
    expect(store.getState().ui.settings).toBe(true)
    expect(store.getState().ui.settingsSection).toBe('sync')
  })
})
