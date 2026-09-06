import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import LockScreen from '@/components/Auth/LockScreen'
import { isBiometricAvailable, unlockBiometric } from '@/lib/commands'
import { renderWithStore } from './utils'
import { setLayout } from './layout'

beforeEach(() => {
  vi.clearAllMocks()
  setLayout('compact')
})

describe('lock screen on compact', () => {
  it('leads with the biometric tile and keeps the passphrase one tap away', async () => {
    renderWithStore(<LockScreen touchID />)

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
    vi.mocked(unlockBiometric).mockResolvedValue({ entries: [], syncConfigured: false })
    const { store } = renderWithStore(<LockScreen touchID />)

    await userEvent.click(screen.getByTestId('biometric-tile'))

    expect(unlockBiometric).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('blames the prompt, not the passphrase, when biometrics fail', async () => {
    vi.mocked(unlockBiometric).mockRejectedValue(new Error('cancelled'))
    renderWithStore(<LockScreen touchID />)

    await userEvent.click(screen.getByTestId('biometric-tile'))

    expect(await screen.findByTestId('unlock-error')).toHaveTextContent(
      'Biometric unlock failed'
    )
    expect(screen.queryByText('Incorrect Master Password')).not.toBeInTheDocument()
  })

  it('shows the passphrase card straight away with no enrollment', () => {
    renderWithStore(<LockScreen touchID={false} />)

    expect(screen.getByTestId('unlock-password-input')).toBeInTheDocument()
    expect(screen.queryByTestId('biometric-tile')).not.toBeInTheDocument()
    expect(screen.queryByTestId('use-password-button')).not.toBeInTheDocument()
  })

  it('is what the auth flow renders on a phone', async () => {
    vi.mocked(isBiometricAvailable).mockResolvedValue(true)
    renderWithStore(<App />)

    expect(await screen.findByTestId('biometric-tile')).toBeInTheDocument()
  })
})
