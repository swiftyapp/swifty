import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from '@/components/Main/Header'
import type { SyncStatus } from '@/api/sync'
import { initialApp, setSyncStatus, useUi } from '@/store'

beforeEach(() => vi.clearAllMocks())

const report = (s: Partial<SyncStatus>) => setSyncStatus({ ...initialApp.sync, ...s })

// Sync configured *and* one run already landed -- the pair the chip needs
// before it will claim to be up to date.
const synced = (s: Partial<SyncStatus> = {}) =>
  report({ configured: true, lastSyncedAt: '2024-01-01T00:00:00.000Z', ...s })

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
    report({ configured: true })
    render(<Header />)
    // Not 'good': no error is the default, and a chip that ticked here would be
    // vouching for a sync that has not happened.
    expect(chip()).toHaveAttribute('data-tone', 'idle')
  })

  it('marks a landed sync as successful', () => {
    synced()
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'good')
  })

  it('spins while a sync is in flight', () => {
    synced({ inProgress: true })
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'loading')
  })

  it('surfaces the backend message on a failed sync', () => {
    synced({ error: 'Drive said no' })
    render(<Header />)
    expect(chip()).toHaveAttribute('data-tone', 'bad')
    expect(chip()).toHaveAccessibleName('Drive said no')
  })

  it('reads as syncing, not failed, when a retry follows an error', () => {
    synced({ error: 'Drive said no' })
    synced({ inProgress: true })
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
