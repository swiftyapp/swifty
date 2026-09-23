import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkspacePicker from '@/components/Auth/WorkspacePicker'
import type { Workspace } from '@/api/types'
import { useApp } from '@/store'
import { appStatusDefault, calls, mockCommand } from './ipc'
import { resetStores, seedApp } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  resetStores()
})

const PRIMARY: Workspace = { id: 'default', name: null }
const WORK: Workspace = { id: 'w2', name: 'Work' }

// What the boot probe said about workspaces, as boot.ts would have stored it.
const seed = (workspaces: Workspace[], activeWorkspace = 'default') =>
  seedApp({ workspaces, activeWorkspace })

describe('WorkspacePicker', () => {
  it('draws nothing on a single-workspace install', () => {
    seed([PRIMARY])
    render(<WorkspacePicker />)

    expect(screen.queryByTestId('workspace-picker')).not.toBeInTheDocument()
  })

  // Only the vault about to open is on the screen; the rest wait in the menu.
  it('wears the open workspace as a chip and lists every one in its menu', async () => {
    seed([PRIMARY, WORK])
    render(<WorkspacePicker />)

    expect(screen.getByTestId('workspace-picker')).toBeInTheDocument()
    // The primary has no name of its own until it is given one.
    expect(screen.getByTestId('workspace-chip')).toHaveTextContent('Personal')
    expect(screen.queryByTestId('workspace-option-w2')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('workspace-chip'))

    expect(screen.getByTestId('workspace-option-default')).toHaveTextContent('Personal')
    expect(screen.getByTestId('workspace-option-w2')).toHaveTextContent('Work')

    await userEvent.click(screen.getByTestId('workspace-option-w2'))

    expect(calls('workspace_select')).toEqual([{ id: 'w2' }])
    expect(screen.queryByTestId('workspace-option-w2')).not.toBeInTheDocument()
  })

  // Where each vault lives is read off what is knowable while it is locked:
  // the open one's live connection, any other's the vault id a sync recorded.
  it('says where each workspace lives', async () => {
    seed([PRIMARY, { ...WORK, vaultId: 'v-work' }])
    render(<WorkspacePicker />)

    await userEvent.click(screen.getByTestId('workspace-chip'))

    expect(screen.getByTestId('workspace-option-default')).toHaveTextContent('This device')
    expect(screen.getByTestId('workspace-option-w2')).toHaveTextContent('Google Drive')
  })

  it('closes the menu on Escape and hands focus back to the chip', async () => {
    seed([PRIMARY, WORK])
    render(<WorkspacePicker />)

    await userEvent.click(screen.getByTestId('workspace-chip'))
    expect(screen.getByTestId('workspace-chip')).toHaveAttribute('aria-expanded', 'true')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByTestId('workspace-option-w2')).not.toBeInTheDocument()
    expect(screen.getByTestId('workspace-chip')).toHaveFocus()
  })

  // Enrollment is per workspace. The lock screen draws the last known gate
  // until the re-probe lands, so the one being left must not be offered for
  // the one being entered.
  it('forgets the biometric gate the moment a switch is asked for', async () => {
    seedApp({
      workspaces: [PRIMARY, WORK],
      activeWorkspace: 'default',
      biometric: { available: true, canEnroll: true, type: 'touch', mode: 'prompt' }
    })
    render(<WorkspacePicker />)

    await userEvent.click(screen.getByTestId('workspace-chip'))
    await userEvent.click(screen.getByTestId('workspace-option-w2'))

    expect(useApp.getState().status?.biometric.available).toBe(false)
  })

  it('puts the gate back when the switch is refused', async () => {
    seedApp({
      workspaces: [PRIMARY, WORK],
      biometric: { available: true, canEnroll: true, type: 'touch', mode: 'prompt' }
    })
    mockCommand('app_status', () => ({
      ...appStatusDefault(),
      biometric: { available: true, canEnroll: true, type: 'touch', mode: 'prompt' }
    }))
    mockCommand('workspace_select', () => Promise.reject({ kind: 'other', message: 'busy' }))
    render(<WorkspacePicker />)

    await userEvent.click(screen.getByTestId('workspace-chip'))
    await userEvent.click(screen.getByTestId('workspace-option-w2'))

    await waitFor(() => expect(useApp.getState().status?.biometric.available).toBe(true))
  })

  it('does nothing when the workspace already open is picked', async () => {
    seed([PRIMARY, WORK])
    render(<WorkspacePicker />)

    // Switching to it would lock and re-open the very screen it is on.
    await userEvent.click(screen.getByTestId('workspace-chip'))
    await userEvent.click(screen.getByTestId('workspace-option-default'))

    expect(calls('workspace_select')).toHaveLength(0)
    expect(screen.queryByTestId('workspace-option-default')).not.toBeInTheDocument()
    // The row that was picked is gone with the menu; the keyboard is back on
    // the chip rather than dropped on the body.
    expect(screen.getByTestId('workspace-chip')).toHaveFocus()
  })
})
