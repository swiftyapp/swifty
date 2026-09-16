import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkspacePicker from '@/components/Auth/WorkspacePicker'
import type { Workspace } from '@/api/types'
import { makeStore, setWorkspaces } from '@/store'
import { renderWithStore } from './utils'
import { appStatusResponse, calls, mockCommand } from './ipc'

beforeEach(() => vi.clearAllMocks())

const PRIMARY: Workspace = { id: 'default', name: null }
const WORK: Workspace = { id: 'w2', name: 'Work' }

// Reset first, then seed: `makeStore` puts the singleton back to its initial
// state, so a list written before it would be thrown away.
const seed = (list: Workspace[], active = 'default') => {
  const store = makeStore()
  setWorkspaces(list, active)
  return store
}

describe('WorkspacePicker', () => {
  it('draws nothing on a single-workspace install', () => {
    renderWithStore(<WorkspacePicker />, { store: seed([PRIMARY]) })

    expect(screen.queryByTestId('workspace-picker')).not.toBeInTheDocument()
  })

  it('lists every workspace once there are two and switches to the one picked', async () => {
    // The switch re-probes; the list it comes back with is still both of them.
    mockCommand('app_status', () =>
      appStatusResponse({ workspaces: [PRIMARY, WORK], activeWorkspace: 'w2' })
    )
    renderWithStore(<WorkspacePicker />, { store: seed([PRIMARY, WORK]) })

    expect(screen.getByTestId('workspace-picker')).toBeInTheDocument()
    // The primary has no name of its own until it is given one.
    expect(screen.getByTestId('workspace-option-default')).toHaveTextContent('Personal')
    expect(screen.getByTestId('workspace-option-w2')).toHaveTextContent('Work')

    await userEvent.click(screen.getByTestId('workspace-option-w2'))

    expect(calls('workspace_select')).toEqual([{ id: 'w2' }])
  })

  it('does nothing when the workspace already open is picked', async () => {
    renderWithStore(<WorkspacePicker />, { store: seed([PRIMARY, WORK]) })

    // Switching to it would lock and re-open the very screen it is on.
    await userEvent.click(screen.getByTestId('workspace-option-default'))

    expect(calls('workspace_select')).toHaveLength(0)
  })
})
