import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Start from '@/components/Start'
import {
  setupCreate as setupCreateCmd,
  setupDriveConnect,
  setupDriveDisconnect,
  setupRestoreFromDrive,
  canEnrollBiometric,
  enableBiometric,
  pickBackup,
  importBackup,
  type SetupDriveFile
} from '@/lib/commands'
import { setupDriveProbed, setupDriveFailed } from '@/store'
import { renderWithStore } from './utils'

// Must satisfy the setup strength gate (>= 12 chars, zxcvbn score >= 2).
const STRONG = 'my-strong-vault-passphrase-2026'

const REMOTE: SetupDriveFile = {
  name: 'vault.swsync',
  size: 1_258_291,
  modifiedTime: '2024-01-01T00:00:00.000Z'
}

beforeEach(() => vi.clearAllMocks())

// Welcome -> the merged password screen, filled in and submitted.
const choosePassword = async (password = STRONG, confirmation = password) => {
  await userEvent.click(screen.getByTestId('start-setup-button'))
  await userEvent.type(screen.getByTestId('setup-password-input'), password)
  await userEvent.type(screen.getByTestId('setup-confirm-password-input'), confirmation)
  await userEvent.click(screen.getByTestId('setup-continue-button'))
}

describe('welcome', () => {
  it('offers a fresh start and both ways back into existing data', () => {
    renderWithStore(<Start />)

    expect(screen.getByText('Keep your secrets to yourself.')).toBeInTheDocument()
    expect(screen.getByTestId('start-setup-button')).toBeInTheDocument()
    expect(screen.getByTestId('start-drive-button')).toBeInTheDocument()
    expect(screen.getByTestId('start-restore-button')).toBeInTheDocument()
  })

  // A phone has no file system to hand a `.swftx` export from, so the option
  // that depends on one is not drawn there at all.
  it('hides the backup-file option on mobile', async () => {
    vi.resetModules()
    vi.doMock('@/lib/platform', () => ({ isIOS: true, isAndroid: false, isMobile: true }))
    try {
      const { default: Welcome } = await import('@/components/Start/Welcome')
      render(<Welcome onFresh={() => {}} onDrive={() => {}} onFile={() => {}} />)

      expect(screen.getByTestId('start-drive-button')).toBeInTheDocument()
      expect(screen.queryByTestId('start-restore-button')).not.toBeInTheDocument()
    } finally {
      vi.doUnmock('@/lib/platform')
      vi.resetModules()
    }
  })
})

describe('choosing a master password', () => {
  it('blocks a weak password without reaching the next step', async () => {
    renderWithStore(<Start />)
    await choosePassword('secret')

    expect((await screen.findAllByText(/Use at least/)).length).toBeGreaterThan(0)
    expect(screen.getByTestId('setup-password-input')).toBeInTheDocument()
    expect(screen.queryByTestId('setup-skip-drive-button')).not.toBeInTheDocument()
  })

  it('refuses a confirmation that does not match', async () => {
    renderWithStore(<Start />)
    await choosePassword(STRONG, 'something-else-entirely')

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(setupCreateCmd).not.toHaveBeenCalled()
  })
})

describe('the backup step', () => {
  it('creates local-only data when the backup is declined', async () => {
    const { store } = renderWithStore(<Start />)
    await choosePassword()

    await userEvent.click(await screen.findByTestId('setup-skip-drive-button'))

    expect(setupCreateCmd).toHaveBeenCalledWith(STRONG, false)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('creates with sync on once the probe finds the account bare', async () => {
    const { store } = renderWithStore(<Start />)
    await choosePassword()

    await userEvent.click(await screen.findByTestId('setup-connect-drive-button'))
    expect(setupDriveConnect).toHaveBeenCalledOnce()
    expect(screen.getByTestId('setup-drive-spinner')).toBeInTheDocument()

    await act(async () => setupDriveProbed(null))

    expect(setupCreateCmd).toHaveBeenCalledWith(STRONG, false)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  // A double-click must not ask the backend to create twice: while the first
  // create is in flight both buttons are inert.
  it('creates once however many times the button is pressed', async () => {
    let finish: (result: { entries: never[]; syncConfigured: boolean }) => void = () => {}
    vi.mocked(setupCreateCmd).mockImplementationOnce(
      () => new Promise(resolve => {
        finish = resolve
      })
    )
    const { store } = renderWithStore(<Start />)
    await choosePassword()

    const skip = await screen.findByTestId('setup-skip-drive-button')
    await userEvent.click(skip)
    await userEvent.click(skip)
    await userEvent.click(screen.getByTestId('setup-connect-drive-button'))

    expect(setupCreateCmd).toHaveBeenCalledOnce()
    expect(setupDriveConnect).not.toHaveBeenCalled()

    await act(async () => finish({ entries: [], syncConfigured: false }))
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  // Leaving while consent is still out with the browser disowns it: a late
  // answer must not be waiting in the store the next time this step is shown.
  it('abandons a consent in flight when the user backs out', async () => {
    const { store } = renderWithStore(<Start />)
    await choosePassword()

    await userEvent.click(await screen.findByTestId('setup-connect-drive-button'))
    expect(screen.getByTestId('setup-drive-spinner')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('go-back-button'))

    expect(setupDriveDisconnect).toHaveBeenCalledOnce()
    expect(store.getState().setup.drive).toEqual({ status: 'idle', file: null, error: null })
    expect(screen.getByTestId('setup-password-input')).toBeInTheDocument()
  })

  it('surfaces a failed connection and leaves the choice standing', async () => {
    renderWithStore(<Start />)
    await choosePassword()

    await userEvent.click(await screen.findByTestId('setup-connect-drive-button'))
    await act(async () => setupDriveFailed('no oauth client configured'))

    expect(await screen.findByTestId('setup-drive-error')).toHaveTextContent(
      'no oauth client configured'
    )
    expect(screen.getByTestId('setup-connect-drive-button')).toBeInTheDocument()
    expect(setupCreateCmd).not.toHaveBeenCalled()
  })
})

describe('a Drive that already holds data', () => {
  const reachConflict = async () => {
    await choosePassword()
    await userEvent.click(await screen.findByTestId('setup-connect-drive-button'))
    await act(async () => setupDriveProbed(REMOTE))
  }

  it('stops to ask rather than writing over the existing pack', async () => {
    renderWithStore(<Start />)
    await reachConflict()

    expect(await screen.findByText('This Drive already has Rowel data')).toBeInTheDocument()
    expect(screen.getByTestId('setup-conflict-file')).toHaveTextContent('vault.swsync')
    expect(setupCreateCmd).not.toHaveBeenCalled()
  })

  it('archives the old one when the new password is kept', async () => {
    const { store } = renderWithStore(<Start />)
    await reachConflict()

    await userEvent.click(await screen.findByTestId('setup-archive-button'))

    expect(setupCreateCmd).toHaveBeenCalledWith(STRONG, true)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('hands over to the restore screen without asking Google again', async () => {
    renderWithStore(<Start />)
    await reachConflict()

    await userEvent.click(await screen.findByTestId('setup-unlock-existing-button'))

    expect(await screen.findByTestId('drive-password-input')).toBeInTheDocument()
    // One connect for the whole flow: the found file is already in hand.
    expect(setupDriveConnect).toHaveBeenCalledOnce()
  })
})

describe('restoring from Google Drive', () => {
  const openDrive = async () => {
    await userEvent.click(screen.getByTestId('start-drive-button'))
  }

  it('waits on consent, then unlocks the pack the probe found', async () => {
    const { store } = renderWithStore(<Start />)
    await openDrive()

    expect(setupDriveConnect).toHaveBeenCalledOnce()
    expect(screen.getByTestId('drive-spinner')).toBeInTheDocument()

    await act(async () => setupDriveProbed(REMOTE))
    expect(screen.getByTestId('drive-found-file')).toHaveTextContent('vault.swsync')

    await userEvent.type(screen.getByTestId('drive-password-input'), STRONG)
    await userEvent.click(screen.getByTestId('drive-unlock-button'))

    expect(setupRestoreFromDrive).toHaveBeenCalledWith(STRONG)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  // Once the unlock is running, the account it runs against is spoken for:
  // switching it, or leaving for a file, is not offered until it settles.
  it('withdraws account switching while the unlock is running', async () => {
    let finish: (result: { entries: never[]; syncConfigured: boolean }) => void = () => {}
    vi.mocked(setupRestoreFromDrive).mockImplementationOnce(
      () => new Promise(resolve => {
        finish = resolve
      })
    )
    const { store } = renderWithStore(<Start />)
    await openDrive()
    await act(async () => setupDriveProbed(REMOTE))
    expect(screen.getByTestId('drive-switch-account')).toBeInTheDocument()

    await userEvent.type(screen.getByTestId('drive-password-input'), STRONG)
    await userEvent.click(screen.getByTestId('drive-unlock-button'))

    expect(screen.queryByTestId('drive-switch-account')).not.toBeInTheDocument()
    expect(screen.queryByTestId('drive-use-file')).not.toBeInTheDocument()

    await act(async () => finish({ entries: [], syncConfigured: true }))
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('names the password as the problem when the pack will not open', async () => {
    vi.mocked(setupRestoreFromDrive).mockRejectedValueOnce('invalid master password')
    const { store } = renderWithStore(<Start />)
    await openDrive()
    await act(async () => setupDriveProbed(REMOTE))

    await userEvent.type(screen.getByTestId('drive-password-input'), 'wrong-password')
    await userEvent.click(screen.getByTestId('drive-unlock-button'))

    expect(await screen.findByText(/isn't the password this was sealed with/)).toBeInTheDocument()
    expect(store.getState().flow.name).not.toBe('main')
  })

  it('sends a bare account back to the create flow, keeping the connection', async () => {
    const { store } = renderWithStore(<Start />)
    await openDrive()
    await act(async () => setupDriveProbed(null))

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('drive-start-fresh-button'))

    // The sync step is skipped: Drive has already been agreed to.
    await userEvent.type(screen.getByTestId('setup-password-input'), STRONG)
    await userEvent.type(screen.getByTestId('setup-confirm-password-input'), STRONG)
    await userEvent.click(screen.getByTestId('setup-continue-button'))

    expect(setupCreateCmd).toHaveBeenCalledWith(STRONG, false)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('gives the pending tokens back when the user walks away', async () => {
    const { store } = renderWithStore(<Start />)
    await openDrive()
    await act(async () => setupDriveProbed(REMOTE))

    await userEvent.click(screen.getByTestId('go-back-button'))

    expect(setupDriveDisconnect).toHaveBeenCalledOnce()
    expect(store.getState().setup.drive).toEqual({ status: 'idle', file: null, error: null })
    expect(screen.getByTestId('start-setup-button')).toBeInTheDocument()
  })

  // Switching to a backup file is leaving the account behind too — the tokens
  // must not sit in the backend for a flow that will never use them.
  it('forgets the account when the user switches to a backup file', async () => {
    renderWithStore(<Start />)
    await openDrive()
    await act(async () => setupDriveProbed(REMOTE))

    await userEvent.click(screen.getByTestId('drive-use-file'))

    expect(setupDriveDisconnect).toHaveBeenCalledOnce()
    expect(screen.getByTestId('restore-dropzone')).toBeInTheDocument()
  })

  // Only the backend's own verdict blames the password; a failure before the
  // password was ever checked is shown as what it was.
  it('shows a non-password failure as itself', async () => {
    vi.mocked(setupRestoreFromDrive).mockRejectedValueOnce('sync file is truncated')
    renderWithStore(<Start />)
    await openDrive()
    await act(async () => setupDriveProbed(REMOTE))

    await userEvent.type(screen.getByTestId('drive-password-input'), STRONG)
    await userEvent.click(screen.getByTestId('drive-unlock-button'))

    expect(await screen.findByText('sync file is truncated')).toBeInTheDocument()
  })
})

describe('restoring from a backup file', () => {
  it('picks a file, then unseals it with its own password', async () => {
    vi.mocked(pickBackup).mockResolvedValue('/tmp/rowel-backup.swftx')
    const { store } = renderWithStore(<Start />)

    await userEvent.click(screen.getByTestId('start-restore-button'))
    await userEvent.click(screen.getByTestId('restore-dropzone'))

    expect(await screen.findByTestId('restore-found-file')).toHaveTextContent(
      'rowel-backup.swftx'
    )

    await userEvent.type(screen.getByTestId('restore-password-input'), STRONG)
    await userEvent.click(screen.getByTestId('restore-confirm-button'))

    expect(importBackup).toHaveBeenCalledWith('/tmp/rowel-backup.swftx', STRONG)
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })
})

describe('the biometric step', () => {
  const reachBiometric = async () => {
    vi.mocked(canEnrollBiometric).mockResolvedValue(true)
    const rendered = renderWithStore(<Start />)
    await choosePassword()
    await userEvent.click(await screen.findByTestId('setup-skip-drive-button'))
    await screen.findByTestId('setup-enable-biometric-button')
    return rendered
  }

  it('is only offered where the device has a gate to offer', async () => {
    vi.mocked(canEnrollBiometric).mockResolvedValue(false)
    const { store } = renderWithStore(<Start />)
    await choosePassword()
    await userEvent.click(await screen.findByTestId('setup-skip-drive-button'))

    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
    expect(screen.queryByTestId('setup-enable-biometric-button')).not.toBeInTheDocument()
  })

  it('enrolls and then opens the app', async () => {
    const { store } = await reachBiometric()

    expect(store.getState().flow.name).not.toBe('main')
    await userEvent.click(screen.getByTestId('setup-enable-biometric-button'))

    expect(enableBiometric).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })

  it('opens the app just the same when it is declined', async () => {
    const { store } = await reachBiometric()

    await userEvent.click(screen.getByTestId('setup-skip-biometric-button'))

    expect(enableBiometric).not.toHaveBeenCalled()
    await waitFor(() => expect(store.getState().flow.name).toBe('main'))
  })
})
