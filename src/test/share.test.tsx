import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  saveEntry
} from '@/lib/commands'
import { renderWithStore, withEntries, loginMeta } from './utils'

const LINK = 'swifty://share#v1.file-1.a2V5LTFrZXktMWtleS0xa2V5LTFrZXktMWtleS0xa2V5'

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

  it('copies the link without arming the clipboard auto-clear', async () => {
    renderWithStore(<Main />, { store: seed() })
    openSend('l1')
    await screen.findByTestId('share-link')

    await userEvent.click(screen.getByTestId('share-copy-button'))

    // One argument: a link is copied to be pasted into a messenger, so unlike a
    // secret it must not be wiped out from under the user.
    expect(copyToClipboard).toHaveBeenCalledWith(LINK)
    expect(screen.getByTestId('share-copy-button')).toHaveTextContent('Copied')
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
})
