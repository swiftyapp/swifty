import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from '@/components/Main/Header'
import { makeStore } from '@/store'
import { renderWithStore } from './utils'

beforeEach(() => vi.clearAllMocks())

// A store with sync configured *and* one run already landed -- the pair the
// chip needs before it will claim to be up to date.
const synced = () => {
  const store = makeStore()
  store.getState().syncConnected()
  store.getState().syncStop({ success: true })
  return store
}

const chip = () => screen.getByTestId('sync-indicator')

describe('Header', () => {
  it('reports a local-only vault rather than hiding the chip', () => {
    renderWithStore(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'local')
    expect(chip()).toHaveAccessibleName(/this device only/i)
    // Lock stays: it is the one control the chrome always owns.
    expect(screen.getByTestId('lock-vault-button')).toBeInTheDocument()
  })

  it('stays unbadged on a fresh connection, before any run has landed', () => {
    const store = makeStore()
    store.getState().syncConnected()
    renderWithStore(<Header />, { store })
    // Not 'good': `success` defaults true, and a chip that ticked here would be
    // vouching for a sync that has not happened.
    expect(chip()).toHaveAttribute('data-tone', 'idle')
  })

  it('marks a landed sync as successful', () => {
    renderWithStore(<Header />, { store: synced() })
    expect(chip()).toHaveAttribute('data-tone', 'good')
  })

  it('spins while a sync is in flight', () => {
    const store = synced()
    store.getState().syncStart()
    renderWithStore(<Header />, { store })
    expect(chip()).toHaveAttribute('data-tone', 'loading')
  })

  it('surfaces the backend message on a failed sync', () => {
    const store = synced()
    store.getState().syncStop({ success: false, error: 'Drive said no' })
    renderWithStore(<Header />, { store })
    expect(chip()).toHaveAttribute('data-tone', 'bad')
    expect(chip()).toHaveAccessibleName('Drive said no')
  })

  it('reads as syncing, not failed, when a retry follows an error', () => {
    const store = synced()
    store.getState().syncStop({ success: false, error: 'Drive said no' })
    store.getState().syncStart()
    renderWithStore(<Header />, { store })
    expect(chip()).toHaveAttribute('data-tone', 'loading')
  })

  // The lock traded IconButton's `title` for the app's Tooltip, and the panel
  // is aria-hidden -- so without `label` the button would be left nameless.
  it('keeps the lock button named after dropping the native tooltip', () => {
    renderWithStore(<Header />)
    const lock = screen.getByTestId('lock-vault-button')
    expect(lock).toHaveAccessibleName('Lock vault')
    expect(lock).not.toHaveAttribute('title')
  })

  it('opens Settings › Sync & devices from the sync chip', async () => {
    const { store } = renderWithStore(<Header />, { store: synced() })

    await userEvent.click(chip())
    expect(store.getState().ui.settings).toBe(true)
    expect(store.getState().ui.settingsSection).toBe('sync')
  })
})
