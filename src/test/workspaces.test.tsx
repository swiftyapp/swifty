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

  it('lists every workspace once there are two and switches to the one picked', async () => {
    seed([PRIMARY, WORK])
    render(<WorkspacePicker />)

    expect(screen.getByTestId('workspace-picker')).toBeInTheDocument()
    // The primary has no name of its own until it is given one.
    expect(screen.getByTestId('workspace-option-default')).toHaveTextContent('Personal')
    expect(screen.getByTestId('workspace-option-w2')).toHaveTextContent('Work')

    await userEvent.click(screen.getByTestId('workspace-option-w2'))

    expect(calls('workspace_select')).toEqual([{ id: 'w2' }])
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

    await userEvent.click(screen.getByTestId('workspace-option-w2'))

    await waitFor(() => expect(useApp.getState().status?.biometric.available).toBe(true))
  })

  it('does nothing when the workspace already open is picked', async () => {
    seed([PRIMARY, WORK])
    render(<WorkspacePicker />)

    // Switching to it would lock and re-open the very screen it is on.
    await userEvent.click(screen.getByTestId('workspace-option-default'))

    expect(calls('workspace_select')).toHaveLength(0)
  })
})
