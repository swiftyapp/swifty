import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Start from '@/components/Start'
import { setup, readVault, pickBackup } from '@/lib/commands'
import { renderWithStore } from './utils'

// Must satisfy the setup strength gate (>= 12 chars, zxcvbn score >= 2).
const STRONG = 'my-strong-vault-passphrase-2026'

beforeEach(() => vi.clearAllMocks())

describe('Start', () => {
  it('offers setup and restore choices', () => {
    renderWithStore(<Start />)
    expect(screen.getByText('Setup Master Password')).toBeInTheDocument()
    expect(screen.getByText('Restore from Backup')).toBeInTheDocument()
  })

  it('completes setup when passwords match', async () => {
    vi.mocked(setup).mockResolvedValue(undefined)
    vi.mocked(readVault).mockResolvedValue([])
    const { store } = renderWithStore(<Start />)

    await userEvent.click(screen.getByText('Setup Master Password'))
    await userEvent.type(screen.getByPlaceholderText('Set Master Password'), STRONG)
    await userEvent.click(screen.getByText('Continue'))
    await userEvent.type(screen.getByPlaceholderText('Confirm Master Password'), STRONG)
    await userEvent.click(screen.getByText('Finish'))

    expect(setup).toHaveBeenCalledWith(STRONG)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('blocks a short/weak master password with feedback', async () => {
    renderWithStore(<Start />)
    await userEvent.click(screen.getByText('Setup Master Password'))
    await userEvent.type(screen.getByPlaceholderText('Set Master Password'), 'secret')
    await userEvent.click(screen.getByText('Continue'))

    // Stays on the setup step (never reaches Confirm) and shows guidance.
    expect(screen.queryByPlaceholderText('Confirm Master Password')).not.toBeInTheDocument()
    expect((await screen.findAllByText(/Use at least/)).length).toBeGreaterThan(0)
  })

  it('warns when setup passwords do not match', async () => {
    renderWithStore(<Start />)
    await userEvent.click(screen.getByText('Setup Master Password'))
    await userEvent.type(screen.getByPlaceholderText('Set Master Password'), STRONG)
    await userEvent.click(screen.getByText('Continue'))
    await userEvent.type(screen.getByPlaceholderText('Confirm Master Password'), 'other')
    await userEvent.click(screen.getByText('Finish'))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(setup).not.toHaveBeenCalled()
  })

  it('picks a backup file on restore', async () => {
    vi.mocked(pickBackup).mockResolvedValue('/tmp/vault.swftx')
    renderWithStore(<Start />)

    await userEvent.click(screen.getByText('Restore from Backup'))
    await userEvent.click(screen.getByText('Choose backup File'))

    expect(pickBackup).toHaveBeenCalledOnce()
    expect(await screen.findByPlaceholderText('Enter Master Password')).toBeInTheDocument()
  })
})
