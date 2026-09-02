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

  it('has no unlock button — Enter is the only way to submit', () => {
    renderWithStore(<Auth touchID />)
    expect(screen.queryByLabelText('Unseal')).not.toBeInTheDocument()
  })

  it('keeps Touch ID in the field and reveals the eye only once typing starts', async () => {
    renderWithStore(<Auth touchID />)

    expect(screen.getByLabelText('Touch ID')).toBeInTheDocument()
    expect(screen.queryByLabelText('Reveal passphrase')).not.toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'a')

    expect(screen.getByLabelText('Reveal passphrase')).toBeInTheDocument()
  })

  it('walks the mascot through idle → typing → error → success', async () => {
    vi.mocked(unlock)
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({ entries: [], syncConfigured: false })
    const { store } = renderWithStore(<Auth touchID={false} />)
    const mascot = () => screen.getByTestId('lock-mascot')
    const input = screen.getByPlaceholderText('Master Password')

    expect(mascot()).toHaveAttribute('data-state', 'idle')

    await userEvent.type(input, 'bad')
    expect(mascot()).toHaveAttribute('data-state', 'typing')

    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(mascot()).toHaveAttribute('data-state', 'error'))

    await userEvent.clear(input)
    await userEvent.type(input, 'right{Enter}')
    await waitFor(() =>
      expect(mascot()).toHaveAttribute('data-state', 'success')
    )
    // The vault entry is held back briefly so the celebration can play.
    expect(store.getState().flow.name).not.toBe('main')
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
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

  it('names the real problem when the vault schema is newer than the app', async () => {
    // Rust's Error::VaultTooNew serializes as this exact string (error.rs).
    vi.mocked(unlock).mockRejectedValue('vault requires a newer version of the app')
    renderWithStore(<Auth touchID={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'right{Enter}')

    expect(await screen.findByText('Vault needs a newer version of Swifty')).toBeInTheDocument()
    expect(screen.queryByText('Incorrect Master Password')).not.toBeInTheDocument()
  })

  it('disables the input and shows a countdown on too many attempts', async () => {
    vi.mocked(unlock).mockRejectedValue({ retryAfterSecs: 2 })
    renderWithStore(<Auth touchID={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'bad{Enter}')

    expect(await screen.findByText(/Try again in 2s/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Master Password')).toBeDisabled()
  })

  it('unlocks with biometrics', async () => {
    vi.mocked(unlockBiometric).mockResolvedValue({ entries: [], syncConfigured: false })
    const { container, store } = renderWithStore(<Auth touchID />)

    await userEvent.click(container.querySelector('.touchid')!)

    expect(unlockBiometric).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })
})
