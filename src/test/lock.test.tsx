import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import LockScreen from '@/components/Auth/LockScreen'
import { useApp } from '@/store'
import { setLayout } from './layout'
import { calls, mockCommand } from './ipc'
import { seedApp } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  setLayout('compact')
})

describe('lock screen on compact', () => {
  it('leads with the biometric tile and keeps the passphrase one tap away', async () => {
    render(<LockScreen biometric />)

    expect(screen.getByTestId('biometric-tile')).toBeInTheDocument()
    expect(screen.queryByTestId('unlock-password-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('unlock-status')).toHaveTextContent('Vault sealed')

    await userEvent.click(screen.getByTestId('use-password-button'))

    expect(screen.getByTestId('unlock-password-input')).toBeInTheDocument()
    // Tapping the tile is still possible from inside the card.
    expect(screen.queryByTestId('biometric-tile')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Touch ID')).toBeInTheDocument()
  })

  it('unlocks from the tile', async () => {
    mockCommand('unlock_biometric', () => ({ entries: [], syncConfigured: false }))
    render(<LockScreen biometric />)

    await userEvent.click(screen.getByTestId('biometric-tile'))

    expect(calls('unlock_biometric')).toHaveLength(1)
    await waitFor(() => expect(useApp.getState().flow).toBe('main'))
  })

  it('blames the prompt, not the passphrase, when biometrics fail', async () => {
    mockCommand('unlock_biometric', () => Promise.reject({ kind: 'cancelled', message: 'cancelled' }))
    render(<LockScreen biometric />)

    await userEvent.click(screen.getByTestId('biometric-tile'))

    expect(await screen.findByTestId('unlock-error')).toHaveTextContent(
      'Biometric unlock failed'
    )
    expect(screen.queryByText('Incorrect Master Password')).not.toBeInTheDocument()
  })

  it('shows the passphrase card straight away with no enrollment', () => {
    render(<LockScreen biometric={false} />)

    expect(screen.getByTestId('unlock-password-input')).toBeInTheDocument()
    expect(screen.queryByTestId('biometric-tile')).not.toBeInTheDocument()
    expect(screen.queryByTestId('use-password-button')).not.toBeInTheDocument()
  })

  // The launch probe answers after the mount, so `biometric` can flip under a
  // card that already has something typed into it.
  it('keeps the card once it has been typed in, whatever the probe says after', async () => {
    const { rerender } = render(<LockScreen biometric={false} />)

    await userEvent.type(screen.getByTestId('unlock-password-input'), 'a')
    rerender(<LockScreen biometric />)

    const input = screen.getByTestId<HTMLInputElement>('unlock-password-input')
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('a')
    expect(screen.queryByTestId('biometric-tile')).not.toBeInTheDocument()
  })

  // The device says which gate it has; the same iOS build runs on both.
  it('names the biometry the backend reported', () => {
    render(<LockScreen biometric biometry="face" />)

    expect(screen.getByLabelText('Face ID')).toBeInTheDocument()
    expect(screen.queryByLabelText('Touch ID')).not.toBeInTheDocument()
  })

  it('is what the auth flow renders on a phone', async () => {
    // What the boot probe said, as boot.ts would have stored it.
    seedApp({ biometric: { available: true, canEnroll: true, type: 'touch', mode: 'prompt' } })
    render(<App />)

    expect(await screen.findByTestId('biometric-tile')).toBeInTheDocument()
  })
})
