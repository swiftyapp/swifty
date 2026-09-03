import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Show from '@/components/Main/Body/Aside/Show'
import Aside from '@/components/Main/Body/Aside'
import Generator from '@/components/Main/Generator'
import AddSecret from '@/components/Main/AddSecret'
import { openAddPicker, makeStore, setCurrentEntry } from '@/store'
import { saveEntry, revealEntry, generatePassword, generateOtp, copyToClipboard, deleteEntry, toEntryMeta } from '@/lib/commands'
import type { LoginEntry } from '@/lib/commands'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveEntry).mockImplementation(entry => Promise.resolve(toEntryMeta(entry)))
})

const titleInput = () => document.querySelector<HTMLInputElement>('input[name="title"]')!
const field = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!

describe('Editing in the pane', () => {
  it('renders login fields for a new entry', () => {
    renderWithStore(<Show type="login" editing />)
    // en-US maps "Website" -> "URL"
    expect(screen.getByText('URL')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('says which kind is being edited, and names the empty title after it', () => {
    renderWithStore(<Show type="card" editing />)
    expect(screen.getByText('Editing')).toBeInTheDocument()
    expect(titleInput()).toHaveAttribute('placeholder', 'Untitled credit card')
  })

  it('saves a valid new login', async () => {
    const { store } = renderWithStore(<Show type="login" editing />)
    await userEvent.type(titleInput(), 'GitHub')
    await userEvent.type(field('username'), 'octocat')
    await userEvent.type(field('password'), 'pw')
    await userEvent.click(screen.getByText('Save'))

    expect(saveEntry).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().entries.items[0].title).toBe('GitHub'))
  })

  it('blocks an invalid save and says which rows are missing', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.click(screen.getByText('Save'))

    expect(saveEntry).not.toHaveBeenCalled()
    // Title, username and password: the three fields login's isValid requires.
    expect(screen.getAllByText('Required')).toHaveLength(3)
  })

  it('closes straight away when nothing was typed', async () => {
    const { store } = renderWithStore(<Show type="login" editing />)
    store.getState().newEntry('login')
    await userEvent.click(screen.getByTestId('cancel-entry-button'))
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument()
    expect(store.getState().entries.new).toBeNull()
  })

  it('guards unsaved changes with an inline confirm', async () => {
    const { store } = renderWithStore(<Show type="login" editing />)
    store.getState().newEntry('login')
    await userEvent.type(titleInput(), 'GitHub')

    // First press only arms the confirm; the editor stays open.
    await userEvent.click(screen.getByTestId('cancel-entry-button'))
    expect(screen.getByText('Discard changes?')).toBeInTheDocument()
    expect(store.getState().entries.new).toBe('login')

    // Second press discards.
    await userEvent.click(screen.getByTestId('cancel-entry-button'))
    expect(store.getState().entries.new).toBeNull()
  })

  it('runs the same discard guard on Escape', async () => {
    const { store } = renderWithStore(<Show type="login" editing />)
    store.getState().newEntry('login')
    await userEvent.type(titleInput(), 'GitHub')

    await userEvent.keyboard('{Escape}')
    expect(screen.getByText('Discard changes?')).toBeInTheDocument()
    expect(store.getState().entries.new).toBe('login')

    await userEvent.keyboard('{Escape}')
    expect(store.getState().entries.new).toBeNull()
  })

  it('stands down on both keys while a dialog owns the keyboard', async () => {
    const { store } = renderWithStore(
      <>
        <Show type="login" editing />
        <AddSecret />
      </>
    )
    store.getState().newEntry('login')
    await userEvent.type(titleInput(), 'GitHub')
    await userEvent.type(field('username'), 'octocat')
    await userEvent.type(field('password'), 'pw')

    // The editor's own listener is on `document`, so it sees these keys on the
    // way down to the dialog's handler. Dismissing a dialog must not end the
    // edit session, and saving behind one must not happen at all.
    act(() => openAddPicker())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument()
    expect(store.getState().entries.new).toBe('login')

    act(() => openAddPicker())
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')
    expect(saveEntry).not.toHaveBeenCalled()
  })

  it('saves on ⌘⏎ from anywhere in the pane', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(titleInput(), 'GitHub')
    await userEvent.type(field('username'), 'octocat')
    await userEvent.type(field('password'), 'pw')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    expect(saveEntry).toHaveBeenCalledOnce()
  })

  it('generates a password through the generator dialog', async () => {
    vi.mocked(generatePassword).mockResolvedValue('Generated123!')
    renderWithStore(
      <>
        <Show type="login" editing />
        <Generator />
      </>
    )
    await userEvent.click(screen.getByText('generate'))
    expect(await screen.findByTestId('generator-dialog')).toBeInTheDocument()
    await screen.findByText('Generated123!')

    await userEvent.click(screen.getByTestId('generator-use-button'))
    await waitFor(() => expect(field('password').value).toBe('Generated123!'))
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
  })

  it('dismisses the generator on Escape without ending the edit session', async () => {
    // The reported reproducer: add a login, open the generator off the password
    // row, press Escape. The editor's Esc listener is on `document`, so it sees
    // the key first — and a draft with nothing typed yet closes with no confirm,
    // silently taking the session down with the dialog.
    vi.mocked(generatePassword).mockResolvedValue('Generated123!')
    const { store } = renderWithStore(
      <>
        <Show type="login" editing />
        <Generator />
      </>
    )
    store.getState().newEntry('login')

    await userEvent.click(screen.getByText('generate'))
    expect(await screen.findByTestId('generator-dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    // Only the generator went.
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
    expect(store.getState().entries.new).toBe('login')
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument()

    // And the editor still owns Escape now that the dialog is gone.
    await userEvent.keyboard('{Escape}')
    expect(store.getState().entries.new).toBeNull()
  })

  it('keeps in-progress edits when the entry refreshes mid-edit', async () => {
    // The revealed title differs from the metadata title so this wait proves
    // the decrypted values were actually adopted, not just the initial meta.
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ title: 'Google (decrypted)' }))
    const { rerender } = renderWithStore(<Show entry={loginMeta()} editing />)
    await waitFor(() => expect(titleInput().value).toBe('Google (decrypted)'))

    await userEvent.clear(titleInput())
    await userEvent.type(titleInput(), 'Renamed by me')

    // A sync merge landing mid-edit bumps updatedAt and re-runs the decrypt.
    // The draft adopts the reveal once, at open — a refetch must not clobber
    // what the user has typed (their save wins by last-writer-wins anyway).
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ title: 'Merged elsewhere' }))
    rerender(<Show entry={loginMeta({ updatedAt: '2024-06-01T00:00:00.000Z' })} editing />)
    await waitFor(() => expect(revealEntry).toHaveBeenCalledTimes(2))

    expect(titleInput().value).toBe('Renamed by me')
  })

  it('starts a new draft empty after reading an entry, and saves it as a new one', async () => {
    // The reproducer behind every multi-entry e2e failure: read an entry, then
    // press Add. Both modes are a `Show` in the same slot, so React kept one
    // instance, and `useRevealed` only drops the old reveal in an effect — one
    // render too late. The fresh draft adopted the read entry, id included, and
    // "Add" quietly saved over it instead of creating a row.
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ title: 'Google' }))
    const store = makeStore()
    withEntries([loginMeta()])
    setCurrentEntry('l1')
    renderWithStore(<Aside />, { store })

    // The read view is up and the reveal has landed.
    await screen.findByTestId('edit-entry-button')
    await waitFor(() => expect(revealEntry).toHaveBeenCalledWith('l1'))

    act(() => store.getState().newEntry('login'))
    expect(titleInput().value).toBe('')

    await userEvent.type(titleInput(), 'GitHub')
    await userEvent.type(field('username'), 'octocat')
    await userEvent.type(field('password'), 'pw')
    await userEvent.click(screen.getByTestId('save-entry-button'))

    // The store mints the id for a draft that has none, so what proves the
    // draft was new is that the id is not the entry we were just reading.
    expect(saveEntry).toHaveBeenCalledOnce()
    const saved = vi.mocked(saveEntry).mock.calls[0][0]
    expect(saved.title).toBe('GitHub')
    expect(saved.id).not.toBe('l1')

    // And the list grew instead of the read entry being overwritten.
    await waitFor(() => expect(store.getState().entries.items).toHaveLength(2))
    expect(store.getState().entries.items[0].title).toBe('Google')
  })
})

describe('Show', () => {
  it('renders entry details', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ title: 'Google' }))
    renderWithStore(<Show entry={loginMeta({ title: 'Google' })} />)
    expect(screen.getByRole('heading', { name: 'Google' })).toBeInTheDocument()
    expect(await screen.findByText('me@example.com')).toBeInTheDocument()
  })

  it('renders and copies a TOTP code', async () => {
    vi.mocked(generateOtp).mockResolvedValue({ code: '123456', time: 25 })
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ otp: 'BASE32SECRET' }) as LoginEntry)
    renderWithStore(<Show entry={loginMeta()} />)

    expect(await screen.findByText('123 456')).toBeInTheDocument()
    expect(generateOtp).toHaveBeenCalledWith('BASE32SECRET')
  })

  it('copies a field value', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ username: 'copyme' }))
    renderWithStore(<Show entry={loginMeta()} />)
    await screen.findByText('copyme')
    // One copy button per rendered row, in row order: URL, then username.
    await userEvent.click(screen.getAllByTitle('Copy')[1])
    expect(copyToClipboard).toHaveBeenCalledWith('copyme', expect.any(Number))
  })

  it('copies the password from the header without revealing it', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password: 'hunter2' }))
    renderWithStore(<Show entry={loginMeta()} />)

    const action = await screen.findByTestId('primary-action-button')
    await waitFor(() => expect(action).toBeEnabled())
    expect(action).toHaveTextContent('Copy password')
    await userEvent.click(action)

    expect(copyToClipboard).toHaveBeenCalledWith('hunter2', expect.any(Number))
    // The password row is still masked: nothing toggled its reveal.
    expect(screen.getByTitle('Reveal')).toBeInTheDocument()
  })

  it('re-decrypts after an in-place save, so copy never serves the old secret', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password: 'old-secret' }))
    const { rerender } = renderWithStore(<Show entry={loginMeta()} />)
    const action = await screen.findByTestId('primary-action-button')
    await waitFor(() => expect(action).toBeEnabled())

    // A save keeps the id but stamps updatedAt. The pane stays mounted across
    // saves, so a decrypt keyed on the id alone kept serving — and copying —
    // the pre-edit password. The regression: rotate, then copy.
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password: 'new-secret' }))
    rerender(<Show entry={loginMeta({ updatedAt: '2024-06-01T00:00:00.000Z' })} />)
    await waitFor(() => expect(revealEntry).toHaveBeenCalledTimes(2))

    const refreshed = screen.getByTestId('primary-action-button')
    await waitFor(() => expect(refreshed).toBeEnabled())
    await userEvent.click(refreshed)

    expect(copyToClipboard).toHaveBeenCalledWith('new-secret', expect.any(Number))
  })

  it('runs the primary action on a bare Enter', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password: 'hunter2' }))
    renderWithStore(<Show entry={loginMeta()} />)

    await waitFor(() => expect(screen.getByTestId('primary-action-button')).toBeEnabled())
    await userEvent.keyboard('{Enter}')

    expect(copyToClipboard).toHaveBeenCalledWith('hunter2', expect.any(Number))
  })

  it('announces the more menu trigger as a disclosure', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry())
    renderWithStore(<Show entry={loginMeta()} />)

    const trigger = screen.getByTestId('more-actions-button')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('leaves Enter to whichever control holds focus', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password: 'hunter2' }))
    renderWithStore(<Show entry={loginMeta()} />)

    await waitFor(() => expect(screen.getByTestId('primary-action-button')).toBeEnabled())

    // Enter on a focused button activates that button and nothing else — it
    // used to open the more menu *and* copy the password.
    screen.getByTestId('more-actions-button').focus()
    await userEvent.keyboard('{Enter}')

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('deletes from the more menu behind a two-press inline confirm', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry())
    renderWithStore(<Show entry={loginMeta()} />)

    await userEvent.click(screen.getByTestId('more-actions-button'))

    // First press only arms the row.
    await userEvent.click(screen.getByText('Delete'))
    expect(deleteEntry).not.toHaveBeenCalled()

    // Second press deletes.
    await userEvent.click(screen.getByText('Delete entry?'))
    await waitFor(() => expect(deleteEntry).toHaveBeenCalledWith('l1'))
  })
})
