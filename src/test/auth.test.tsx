import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Auth from '@/components/Auth'
import { renderWithStore } from './utils'
import { calls, mockCommand, mockCommandOnce } from './ipc'

beforeEach(() => vi.clearAllMocks())

describe('Auth', () => {
  it('renders the lock screen', () => {
    renderWithStore(<Auth biometric={false} />)
    expect(screen.getByPlaceholderText('Master Password')).toBeInTheDocument()
  })

  it('footers the version and where the vault lives', async () => {
    renderWithStore(<Auth biometric={false} />)
    expect(
      await screen.findByText('Rowel 1.0.0 · Vault on this device')
    ).toBeInTheDocument()
  })

  it('has no unlock button — Enter is the only way to submit', () => {
    renderWithStore(<Auth biometric />)
    expect(screen.queryByLabelText('Unseal')).not.toBeInTheDocument()
  })

  it('keeps Touch ID in the field and reveals the eye only once typing starts', async () => {
    renderWithStore(<Auth biometric />)

    expect(screen.getByLabelText('Touch ID')).toBeInTheDocument()
    expect(screen.queryByLabelText('Reveal passphrase')).not.toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'a')

    expect(screen.getByLabelText('Reveal passphrase')).toBeInTheDocument()
  })

  it('puts the caret where you click so backspace edits mid-passphrase', async () => {
    renderWithStore(<Auth biometric={false} />)
    const input = screen.getByPlaceholderText<HTMLInputElement>('Master Password')

    await userEvent.type(input, 'abcd')
    expect(input.selectionStart).toBe(4)

    // jsdom lays the cell row out at x=0, so 30px (two 15px cells) is the
    // boundary between 'b' and 'c'.
    fireEvent.mouseDown(input, { clientX: 30, button: 0 })
    expect(input.selectionStart).toBe(2)
    expect(input.selectionEnd).toBe(2)

    await userEvent.keyboard('{Backspace}')
    expect(input.value).toBe('acd')
    expect(input.selectionStart).toBe(1)
  })

  it('acknowledges Enter immediately with a verifying state', async () => {
    // Never resolves: we're asserting the in-flight presentation.
    mockCommand('unlock', () => new Promise(() => {}))
    renderWithStore(<Auth biometric={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'pw{Enter}')

    expect(screen.getByTestId('unlock-status')).toHaveTextContent('Verifying')
    expect(screen.getByTestId('lock-mascot')).toHaveAttribute('data-state', 'checking')
    expect(screen.getByPlaceholderText('Master Password')).toBeDisabled()
  })

  it('walks the mascot through idle → typing → error → success', async () => {
    mockCommandOnce('unlock', () =>
      Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' })
    )
    mockCommandOnce('unlock', () => ({ entries: [], syncConfigured: false }))
    const { store } = renderWithStore(<Auth biometric={false} />)
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
    mockCommand('unlock', () => ({ entries: [], syncConfigured: false }))
    const { store } = renderWithStore(<Auth biometric={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'hunter2{Enter}')

    expect(calls('unlock')).toContainEqual({ password: 'hunter2' })
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('shows an error on a wrong password', async () => {
    mockCommand('unlock', () => Promise.reject({ kind: 'invalidPassword', message: 'invalid master password' }))
    renderWithStore(<Auth biometric={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'bad{Enter}')

    expect(await screen.findByText('Incorrect Master Password')).toBeInTheDocument()
  })

  it('names the real problem when the vault schema is newer than the app', async () => {
    mockCommand('unlock', () =>
      Promise.reject({ kind: 'vaultTooNew', message: 'vault requires a newer version of the app' })
    )
    renderWithStore(<Auth biometric={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'right{Enter}')

    expect(await screen.findByText('Vault needs a newer version of Rowel')).toBeInTheDocument()
    expect(screen.queryByText('Incorrect Master Password')).not.toBeInTheDocument()
  })

  it('disables the input and shows a countdown on too many attempts', async () => {
    mockCommand('unlock', () =>
      Promise.reject({ kind: 'tooManyAttempts', message: 'too many attempts', retryAfterSecs: 2 })
    )
    renderWithStore(<Auth biometric={false} />)

    await userEvent.type(screen.getByPlaceholderText('Master Password'), 'bad{Enter}')

    expect(await screen.findByText(/Try again in 2s/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Master Password')).toBeDisabled()
  })

  it('unlocks with biometrics', async () => {
    mockCommand('unlock_biometric', () => ({ entries: [], syncConfigured: false }))
    const { store } = renderWithStore(<Auth biometric />)

    await userEvent.click(screen.getByLabelText('Touch ID'))

    expect(calls('unlock_biometric')).toHaveLength(1)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })
})
