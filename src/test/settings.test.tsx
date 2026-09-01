import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '@/components/Main/Sidebar/Settings'
import { setLocale } from '@/i18n'
import {
  changeMasterPassword,
  generatePassword,
  enableBiometric,
  disableBiometric,
  isBiometricAvailable,
  pickBackup,
  importSwftx,
  syncConnect
} from '@/lib/commands'
import { renderWithStore } from './utils'

beforeEach(() => vi.clearAllMocks())
afterEach(() => setLocale('en-US'))

const open = async () => {
  const { container, store } = renderWithStore(<Settings />)
  await userEvent.click(container.querySelector('.settings-button')!)
  return { container, store }
}

describe('Settings', () => {
  it('opens the preferences modal on the vault section', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Vault Settings' })).toBeInTheDocument()
    expect(screen.getByText('Save Vault File')).toBeInTheDocument()
  })

  it('offers Google Drive sync on the vault section', async () => {
    await open()
    await userEvent.click(screen.getByText('Connect your Google Drive'))
    expect(syncConnect).toHaveBeenCalledOnce()
  })

  it('shows a generated example on the password section', async () => {
    vi.mocked(generatePassword).mockResolvedValue('Generated123!')
    await open()
    await userEvent.click(screen.getByText('Password Generation'))
    expect(await screen.findByText('Generated123!')).toBeInTheDocument()
  })

  it('changes the master password', async () => {
    vi.mocked(changeMasterPassword).mockResolvedValue(undefined)
    await open()
    await userEvent.click(screen.getByText('Master Password'))

    const inputs = document.querySelectorAll<HTMLInputElement>(
      '.preferences input[type="password"]'
    )
    await userEvent.type(inputs[0], 'old')
    await userEvent.type(inputs[1], 'newpass')
    await userEvent.type(inputs[2], 'newpass')
    await userEvent.click(screen.getByText('Update'))

    expect(changeMasterPassword).toHaveBeenCalledWith('old', 'newpass')
    expect(await screen.findByText('Successfully changed password')).toBeInTheDocument()
  })

  it('enables biometric unlock when currently disabled', async () => {
    vi.mocked(isBiometricAvailable).mockResolvedValue(false)
    vi.mocked(enableBiometric).mockResolvedValue(undefined)
    await open()
    await userEvent.click(screen.getByText('Biometric Unlock'))

    await userEvent.click(await screen.findByText('Enable Biometric Unlock'))

    expect(enableBiometric).toHaveBeenCalledOnce()
    expect(await screen.findByText('Disable Biometric Unlock')).toBeInTheDocument()
  })

  it('disables biometric unlock when currently enabled', async () => {
    vi.mocked(isBiometricAvailable).mockResolvedValue(true)
    vi.mocked(disableBiometric).mockResolvedValue(undefined)
    await open()
    await userEvent.click(screen.getByText('Biometric Unlock'))

    await userEvent.click(await screen.findByText('Disable Biometric Unlock'))

    expect(disableBiometric).toHaveBeenCalledOnce()
    expect(await screen.findByText('Enable Biometric Unlock')).toBeInTheDocument()
  })

  it('imports a .swftx file into the current vault with the source password', async () => {
    vi.mocked(pickBackup).mockResolvedValue('/tmp/other.swftx')
    vi.mocked(importSwftx).mockResolvedValue(3)
    await open()
    await userEvent.click(screen.getByText('Import Vault'))

    await userEvent.click(screen.getByText('Choose backup File'))
    // The chosen file name replaces the picker label.
    await screen.findByText('other.swftx')

    const input = document.querySelector<HTMLInputElement>('.preferences input[type="password"]')!
    await userEvent.type(input, 'source-pw')
    await userEvent.click(screen.getByText('Run import'))

    expect(importSwftx).toHaveBeenCalledWith('/tmp/other.swftx', 'source-pw')
    expect(await screen.findByText(/Imported/)).toBeInTheDocument()
  })

  it('shows an error when the source password is wrong', async () => {
    vi.mocked(pickBackup).mockResolvedValue('/tmp/other.swftx')
    vi.mocked(importSwftx).mockRejectedValue(new Error('invalid password'))
    await open()
    await userEvent.click(screen.getByText('Import Vault'))

    await userEvent.click(screen.getByText('Choose backup File'))
    await screen.findByText('other.swftx')
    await userEvent.click(screen.getByText('Run import'))

    expect(await screen.findByText('Invalid password for backup')).toBeInTheDocument()
  })

  it('lists language options', async () => {
    const { store } = await open()
    await userEvent.click(screen.getByText('Language'))
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, 'de-DE')
    expect(store.getState().i18n.locale).toBe('de-DE')
  })
})
