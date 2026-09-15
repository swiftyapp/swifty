import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from '@/components/Main/Header'
import { useUi, setSyncStatus, initialApp } from '@/store'
import type { SyncStatus } from '@/lib/commands'

beforeEach(() => vi.clearAllMocks())

// What the backend would report, one snapshot at a time.
const report = (status: Partial<SyncStatus>) =>
  setSyncStatus({ ...initialApp.sync, configured: true, ...status })

// Sync configured *and* one run already landed -- the pair the chip needs
// before it will claim to be up to date.
const synced = () => report({ lastSyncedAt: '2024-01-01T00:00:00.000Z' })

const chip = () => screen.getByTestId('sync-indicator')

describe('Header', () => {
  it('reports a local-only vault rather than hiding the chip', () => {
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'local')
    expect(chip()).toHaveAccessibleName(/this device only/i)
    // Lock stays: it is the one control the chrome always owns.
    expect(screen.getByTestId('lock-vault-button')).toBeInTheDocument()
  })

  it('stays unbadged on a fresh connection, before any run has landed', () => {
    report({})
    render(<Header />)
    // Not 'good': a chip that ticked here would be vouching for a sync that
    // has not happened.
    expect(chip()).toHaveAttribute('data-tone', 'idle')
  })

  it('marks a landed sync as successful', () => {
    synced()
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'good')
  })

  it('spins while a sync is in flight', () => {
    report({ lastSyncedAt: '2024-01-01T00:00:00.000Z', inProgress: true })
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'loading')
  })

  it('surfaces the backend message on a failed sync', () => {
    report({ lastSyncedAt: '2024-01-01T00:00:00.000Z', error: 'Drive said no' })
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'bad')
    expect(chip()).toHaveAccessibleName('Drive said no')
  })

  it('reads as syncing, not failed, when a retry follows an error', () => {
    report({ lastSyncedAt: '2024-01-01T00:00:00.000Z', error: 'Drive said no' })
    // The backend clears the error when the next run starts.
    report({ lastSyncedAt: '2024-01-01T00:00:00.000Z', inProgress: true })
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'loading')
  })

  // The lock traded IconButton's `title` for the app's Tooltip, and the panel
  // is aria-hidden -- so without `label` the button would be left nameless.
  it('keeps the lock button named after dropping the native tooltip', () => {
    render(<Header />)
    const lock = screen.getByTestId('lock-vault-button')
    expect(lock).toHaveAccessibleName('Lock vault')
    expect(lock).not.toHaveAttribute('title')
  })

  it('opens Settings › Sync & devices from the sync chip', async () => {
    synced()
    render(<Header />)

    await userEvent.click(chip())
    expect(useUi.getState().settings).toBe(true)
    expect(useUi.getState().settingsSection).toBe('sync')
  })
})
