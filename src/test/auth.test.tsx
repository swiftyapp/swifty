import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Auth from '@/components/Auth'
import { unlock, unlockBiometric } from '@/lib/commands'
import { renderWithStore } from './utils'

beforeEach(() => vi.clearAllMocks())

describe('Auth', () => {
  it('renders the lock screen', () => {
    renderWithStore(<Auth touchID={false} />)
    expect(screen.getByPlaceholderText('Master Password')).toBeInTheDocument()
  })

  it('unlocks the vault on Enter', async () => {
    vi.mocked(unlock).mockResolvedValue({ entries: [], syncConfigured: false })
    const { store } = renderWithStore(<Auth touchID={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'hunter2{Enter}')

    expect(unlock).toHaveBeenCalledWith('hunter2')
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('shows an error on a wrong password', async () => {
    vi.mocked(unlock).mockRejectedValue(new Error('nope'))
    renderWithStore(<Auth touchID={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'bad{Enter}')

    expect(await screen.findByText('Incorrect Master Password')).toBeInTheDocument()
  })

  it('unlocks with biometrics', async () => {
    vi.mocked(unlockBiometric).mockResolvedValue({ entries: [], syncConfigured: false })
    const { container, store } = renderWithStore(<Auth touchID />)

    await userEvent.click(container.querySelector('.touchid')!)

    expect(unlockBiometric).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })
})
