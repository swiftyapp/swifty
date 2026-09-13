import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import Settings from '@/components/Main/Sidebar/Settings'
import {
  makeStore,
  useStore,
  openSend,
  openReceive,
  syncInit
} from '@/store'
import {
  shareCreate,
  shareOpen,
  shareRevoke,
  shareList,
  copyToClipboard,
  saveEntry,
  type Entry,
  type ShareCreated
} from '@/lib/commands'
import { DEFAULT_CLIPBOARD_TIMEOUT } from '@/defaults/clipboard'
import { renderWithStore, withEntries, loginMeta, deferred } from './utils'

const LINK = 'swifty://share#v1.file-1.a2V5LTFrZXktMWtleS0xa2V5LTFrZXktMWtleS0xa2V5'

const created = (fileId: string): ShareCreated => ({
  link: `swifty://share#v1.${fileId}.a2V5`,
  fileId,
  expiresAt: '2024-01-02T00:00:00.000Z'
})

const seed = ({ connected = true } = {}) => {
  const store = makeStore()
  withEntries([loginMeta({ id: 'l1', title: 'Google' })])
  if (connected) syncInit(true)
  return store
}

// A share still N hours out. Half an hour past the mark so the floor in
// `relativeUntil` cannot land a millisecond short and read one hour less.
const inHours = (hours: number) =>
  new Date(Date.now() + (hours + 0.5) * 3_600_000).toISOString()

beforeEach(() => vi.clearAllMocks())

describe('sharing an entry', () => {
  it('asks for Drive rather than offering a link it cannot make', async () => {
    renderWithStore(<Main />, { store: seed({ connected: false }) })

    openSend('l1')

    expect(await screen.findByTestId('share-needs-drive')).toHaveTextContent(
      'Connect Google Drive to share'
    )
    // Nothing is sealed, and nothing is uploaded, until there is a Drive to put
    // it in — the dialog explains instead of failing at the backend.
    expect(shareCreate).not.toHaveBeenCalled()
  })

  it('seals on open and shows the link', async () => {
    renderWithStore(<Main />, { store: seed() })

    openSend('l1')

    const field = await screen.findByTestId('share-link')
    expect(shareCreate).toHaveBeenCalledWith('l1')
    expect(field).toHaveValue(LINK)
    expect(field).toHaveAttribute('readonly')
    expect(screen.getByTestId('share-send-modal')).toHaveAccessibleName('Share this entry')
    expect(screen.getByText('Expires in 24 hours')).toBeInTheDocument()
  })

  it('copies the link under the clipboard timeout the user chose', async () => {
    renderWithStore(<Main />, { store: seed() })
    openSend('l1')
    await screen.findByTestId('share-link')

    await userEvent.click(screen.getByTestId('share-copy-button'))

    // The link opens the entry for anyone holding it, so it leaves the
    // clipboard on the same timer as the secrets it stands in for.
    expect(copyToClipboard).toHaveBeenCalledWith(LINK, DEFAULT_CLIPBOARD_TIMEOUT)
    expect(screen.getByTestId('share-copy-button')).toHaveTextContent('Copied')
  })

  it('shows the link of the entry being shared, and takes back the one nobody saw', async () => {
    const first = deferred<ShareCreated>()
    const second = deferred<ShareCreated>()
    vi.mocked(shareCreate)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderWithStore(<Main />, { store: seed() })

    openSend('l1')
    await screen.findByTestId('share-send-loading')
    act(() => openSend('l2'))
    await act(async () => second.resolve(created('file-b')))
    // The first seal lands last, on a dialog that has moved to another entry.
    await act(async () => first.resolve(created('file-a')))

    expect(screen.getByTestId('share-link')).toHaveValue(created('file-b').link)
    // Its link was never on screen and never will be, so the file it points at
    // must not be left sitting in the sender's Drive for 24 hours.
    await vi.waitFor(() => expect(shareRevoke).toHaveBeenCalledWith('file-a'))
    expect(shareRevoke).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(useStore.getState().share.orphans).toEqual([]))
  })

  it('remembers a share it could not take back, and tries again on the next dialog', async () => {
    const first = deferred<ShareCreated>()
    vi.mocked(shareCreate)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(created('file-b'))
    vi.mocked(shareRevoke).mockRejectedValueOnce('offline')
    renderWithStore(<Main />, { store: seed() })

    openSend('l1')
    await screen.findByTestId('share-send-loading')
    act(() => openSend('l2'))
    await screen.findByTestId('share-link')
    await act(async () => first.resolve(created('file-a')))

    // The take-back failed, so the share is still live in Drive and this is the
    // only record that it exists.
    await vi.waitFor(() => expect(shareRevoke).toHaveBeenCalledWith('file-a'))
    expect(useStore.getState().share.orphans).toEqual(['file-a'])

    // Opening any share dialog is the next chance to make it right.
    act(() => useStore.getState().closeSend())
    act(() => openSend('l1'))

    await vi.waitFor(() => expect(shareRevoke).toHaveBeenCalledTimes(2))
    expect(shareRevoke).toHaveBeenLastCalledWith('file-a')
    await vi.waitFor(() => expect(useStore.getState().share.orphans).toEqual([]))
  })

  it('revokes the link and closes', async () => {
    renderWithStore(<Main />, { store: seed() })
    openSend('l1')
    await screen.findByTestId('share-link')

    await userEvent.click(screen.getByTestId('share-revoke-button'))

    expect(shareRevoke).toHaveBeenCalledWith('file-1')
    expect(screen.queryByTestId('share-send-modal')).not.toBeInTheDocument()
    expect(useStore.getState().share.sendFor).toBeNull()
  })

  it('shows what the backend said when the seal fails', async () => {
    vi.mocked(shareCreate).mockRejectedValueOnce('sync is not configured')
    renderWithStore(<Main />, { store: seed() })

    openSend('l1')

    expect(await screen.findByTestId('share-send-error')).toHaveTextContent(
      'sync is not configured'
    )
    await userEvent.click(screen.getByTestId('share-retry-button'))
    expect(await screen.findByTestId('share-link')).toHaveValue(LINK)
  })

  it('says why a passkey-only login cannot be shared, and offers the way out', async () => {
    const refusal = 'a login whose only secret is a passkey cannot be shared'
    vi.mocked(shareCreate).mockRejectedValueOnce(refusal)
    renderWithStore(<Main />, { store: seed() })

    openSend('l1')

    expect(await screen.findByTestId('share-send-error')).toHaveTextContent(refusal)
    expect(screen.getByTestId('share-close-button')).toBeInTheDocument()
    expect(screen.queryByTestId('share-link')).not.toBeInTheDocument()
  })

  it('retries the revoke that failed rather than sealing a second link', async () => {
    vi.mocked(shareRevoke).mockRejectedValueOnce('drive is unreachable')
    renderWithStore(<Main />, { store: seed() })
    openSend('l1')
    await screen.findByTestId('share-link')

    await userEvent.click(screen.getByTestId('share-revoke-button'))
    expect(await screen.findByTestId('share-send-error')).toHaveTextContent('drive is unreachable')
    // The link is still live, so it is still on screen — with the way to take
    // it back still under it.
    expect(screen.getByTestId('share-link')).toHaveValue(LINK)

    await userEvent.click(screen.getByTestId('share-revoke-button'))

    expect(shareRevoke).toHaveBeenCalledTimes(2)
    // A second seal would have published a second link while the first was
    // still out there.
    expect(shareCreate).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('share-send-modal')).not.toBeInTheDocument()
  })

  it('is offered from the detail header of a live entry', async () => {
    renderWithStore(<Main />, { store: seed() })
    await userEvent.click(await screen.findByTestId('entry-item'))

    await userEvent.click(await screen.findByTestId('more-actions-button'))
    await userEvent.click(screen.getByTestId('share-entry-button'))

    expect(useStore.getState().share.sendFor).toBe('l1')
  })
})

describe('receiving a shared entry', () => {
  const paste = async (link = LINK) => {
    openReceive()
    await userEvent.type(await screen.findByTestId('share-link-input'), link)
    await userEvent.click(screen.getByTestId('share-open-button'))
  }

  it('is reachable from the kind picker', async () => {
    renderWithStore(<Main />, { store: seed() })
    await userEvent.click(screen.getByTestId('add-entry-button'))

    await userEvent.click(screen.getByTestId('add-receive-share'))

    expect(useStore.getState().share.receiveOpen).toBe(true)
    expect(useStore.getState().ui.addPicker).toBe(false)
  })

  it('shows a backend refusal verbatim', async () => {
    vi.mocked(shareOpen).mockRejectedValueOnce('this share has expired or was revoked')
    renderWithStore(<Main />, { store: seed() })

    await paste('not-a-link')

    expect(await screen.findByTestId('share-receive-error')).toHaveTextContent(
      'this share has expired or was revoked'
    )
    expect(screen.queryByTestId('share-preview')).not.toBeInTheDocument()
  })

  it('previews without showing a single secret', async () => {
    renderWithStore(<Main />, { store: seed() })

    await paste()

    const preview = within(await screen.findByTestId('share-preview'))
    expect(preview.getByTestId('share-preview-title')).toHaveTextContent('Shared Netflix')
    expect(preview.getByText('shared@example.com')).toBeInTheDocument()
    expect(preview.getByText('https://netflix.com')).toBeInTheDocument()
    // The password is counted, never drawn.
    expect(preview.getByTestId('share-preview-secrets')).toHaveTextContent(
      '1 secret field included'
    )
    expect(screen.queryByText('from-a-friend')).not.toBeInTheDocument()
  })

  it('adds it as a new entry of its own', async () => {
    renderWithStore(<Main />, { store: seed() })
    await paste()
    await screen.findByTestId('share-preview')

    await userEvent.click(screen.getByTestId('share-add-button'))

    expect(saveEntry).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(saveEntry).mock.calls[0][0] as unknown as Record<string, unknown>
    // The sender's row id never travels; this vault mints its own.
    expect(saved.id).toEqual(expect.any(String))
    expect(saved.id).not.toBe('')
    expect(saved.createdAt).toEqual(expect.any(String))
    expect(saved).toMatchObject({
      type: 'login',
      title: 'Shared Netflix',
      username: 'shared@example.com',
      password: 'from-a-friend'
    })

    await vi.waitFor(() => {
      expect(useStore.getState().share.receiveOpen).toBe(false)
      expect(useStore.getState().entries.current?.title).toBe('Shared Netflix')
    })
  })

  it('keeps nothing of the last link once the dialog is closed', async () => {
    renderWithStore(<Main />, { store: seed() })
    await paste()
    await screen.findByTestId('share-preview')

    await userEvent.click(screen.getByTestId('share-cancel-button'))
    act(() => openReceive())

    // Someone else's secret does not sit in memory behind a closed dialog, and
    // reopening asks the one question this dialog is for.
    const input = await screen.findByTestId('share-link-input')
    expect(input).toHaveValue('')
    expect(screen.queryByTestId('share-preview')).not.toBeInTheDocument()
    expect(screen.getByTestId('share-open-button')).toBeInTheDocument()
  })

  it('takes the secret and none of the sender claims about it', async () => {
    vi.mocked(shareOpen).mockResolvedValueOnce({
      id: 'existing-id',
      type: 'login',
      title: 'Shared Netflix',
      website: 'https://netflix.com',
      username: 'shared@example.com',
      password: 'from-a-friend',
      email: '',
      note: '',
      otp: '',
      createdAt: '2019-01-01T00:00:00.000Z',
      updatedAt: '2019-01-01T00:00:00.000Z',
      password_updated_at: '2019-01-01T00:00:00.000Z',
      favorite: true,
      passkeys: [{ id: 'pk1', rpId: 'netflix.com' }]
    } as unknown as Entry)
    renderWithStore(<Main />, { store: seed() })
    await paste()
    await screen.findByTestId('share-preview')

    await userEvent.click(screen.getByTestId('share-add-button'))

    const saved = vi.mocked(saveEntry).mock.calls[0][0] as unknown as Record<string, unknown>
    expect(saved.password).toBe('from-a-friend')
    // An id chosen by the sender is an id that could name a row already here.
    expect(saved.id).toEqual(expect.any(String))
    expect(saved.id).not.toBe('existing-id')
    expect(saved.id).not.toBe('')
    expect(saved.favorite).toBeFalsy()
    expect(saved).not.toHaveProperty('passkeys')
    expect(saved).not.toHaveProperty('password_updated_at')
    expect(saved.createdAt).not.toBe('2019-01-01T00:00:00.000Z')
  })
})

describe('Settings › Shared links', () => {
  const expand = async () => {
    renderWithStore(<Settings />, { store: seed() })
    useStore.getState().openSettings('sync')
    const row = within(await screen.findByTestId('settings-shares-row'))
    await userEvent.click(row.getByRole('button', { name: 'Show' }))
  }

  it('is not offered without Drive', async () => {
    renderWithStore(<Settings />, { store: seed({ connected: false }) })
    useStore.getState().openSettings('sync')

    expect(await screen.findByTestId('settings-drive-row')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-shares-row')).not.toBeInTheDocument()
  })

  it('lists live links, naming the entry each came from', async () => {
    vi.mocked(shareList).mockResolvedValueOnce([
      {
        fileId: 'f1',
        entryId: 'l1',
        kind: 'login',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: inHours(3)
      },
      {
        fileId: 'f2',
        entryId: 'gone',
        kind: 'card',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: inHours(20)
      }
    ])

    await expand()

    const first = within(await screen.findByTestId('settings-share-f1'))
    expect(first.getByText('Google')).toBeInTheDocument()
    expect(screen.getByTestId('settings-share-f1')).toHaveTextContent(
      'Login · Expires in 3 hours'
    )
    // A share outlives the entry it was cut from, and says so.
    expect(within(screen.getByTestId('settings-share-f2')).getByText('Deleted entry'))
      .toBeInTheDocument()
  })

  it('revokes one and drops it from the list', async () => {
    vi.mocked(shareList).mockResolvedValueOnce([
      {
        fileId: 'f1',
        entryId: 'l1',
        kind: 'login',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: inHours(3)
      }
    ])

    await expand()
    await screen.findByTestId('settings-share-f1')

    await userEvent.click(screen.getByTestId('settings-share-revoke-f1'))

    expect(shareRevoke).toHaveBeenCalledWith('f1')
    expect(await screen.findByTestId('settings-shares-empty')).toHaveTextContent(
      'No active links'
    )
  })

  it('says so when there is nothing out there', async () => {
    await expand()

    expect(await screen.findByTestId('settings-shares-empty')).toBeInTheDocument()
    expect(shareList).toHaveBeenCalled()
  })

  it('keeps the countdown honest while the row stays open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const share = (expiresAt: string) => ({
        fileId: 'f1',
        entryId: 'l1',
        kind: 'login' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt
      })
      // Two minutes and a half out, then — once the row has watched it run
      // out — gone from the backend's own listing.
      vi.mocked(shareList)
        .mockResolvedValueOnce([share(new Date(Date.now() + 150_000).toISOString())])
        .mockResolvedValueOnce([])
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderWithStore(<Settings />, { store: seed() })
      useStore.getState().openSettings('sync')
      const row = within(await screen.findByTestId('settings-shares-row'))
      await user.click(row.getByRole('button', { name: 'Show' }))
      expect(await screen.findByTestId('settings-share-f1')).toHaveTextContent(
        'Expires in 2 minutes'
      )

      // Nothing else re-renders this row; only its own clock can.
      await act(async () => {
        vi.advanceTimersByTime(60_000)
      })
      expect(screen.getByTestId('settings-share-f1')).toHaveTextContent('Expires in 1 minute')

      await act(async () => {
        vi.advanceTimersByTime(120_000)
      })
      // Past the mark the row asks again instead of showing "Expired" for a
      // file the sweep has already removed.
      expect(await screen.findByTestId('settings-shares-empty')).toBeInTheDocument()
      expect(shareList).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
