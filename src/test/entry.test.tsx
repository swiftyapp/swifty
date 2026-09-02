import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Form from '@/components/Main/Body/Aside/Form'
import Show from '@/components/Main/Body/Aside/Show'
import Generator from '@/components/Main/Generator'
import { saveEntry, revealEntry, generatePassword, generateOtp, copyToClipboard, deleteEntry, toEntryMeta } from '@/lib/commands'
import type { LoginEntry } from '@/lib/commands'
import { kindOf } from '@/kinds'
import { t } from '@/i18n'
import { renderWithStore, loginEntry, loginMeta } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveEntry).mockImplementation(entry => Promise.resolve(toEntryMeta(entry)))
})

describe('Form', () => {
  it('renders login fields for a new entry', () => {
    renderWithStore(<Form type="login" />)
    // en-US maps "Website" -> "URL"
    expect(screen.getByText('URL')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('saves a valid new login', async () => {
    const { store } = renderWithStore(<Form type="login" />)
    await userEvent.type(document.querySelector('input[name="title"]')!, 'GitHub')
    await userEvent.type(document.querySelector('input[name="username"]')!, 'octocat')
    await userEvent.type(document.querySelector('input[name="password"]')!, 'pw')
    await userEvent.click(screen.getByText('Save'))

    expect(saveEntry).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().entries.items[0].title).toBe('GitHub'))
  })

  it('blocks saving an invalid entry', async () => {
    renderWithStore(<Form type="login" />)
    await userEvent.click(screen.getByText('Save'))
    expect(saveEntry).not.toHaveBeenCalled()
  })

  it('closes straight away when nothing was typed', async () => {
    const { store } = renderWithStore(<Form type="login" />)
    store.getState().newEntry('login')
    await userEvent.click(screen.getByTestId('cancel-entry-button'))
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument()
    expect(store.getState().entries.new).toBeNull()
  })

  it('guards unsaved changes with an inline confirm', async () => {
    const { store } = renderWithStore(<Form type="login" />)
    store.getState().newEntry('login')
    await userEvent.type(document.querySelector('input[name="title"]')!, 'GitHub')

    // First press only arms the confirm; the form stays open.
    await userEvent.click(screen.getByTestId('cancel-entry-button'))
    expect(screen.getByText('Discard changes?')).toBeInTheDocument()
    expect(store.getState().entries.new).toBe('login')

    // Second press discards.
    await userEvent.click(screen.getByTestId('cancel-entry-button'))
    expect(store.getState().entries.new).toBeNull()
  })

  it('saves on ⌘⏎ from anywhere in the sheet', async () => {
    renderWithStore(<Form type="login" />)
    await userEvent.type(document.querySelector('input[name="title"]')!, 'GitHub')
    await userEvent.type(document.querySelector('input[name="username"]')!, 'octocat')
    await userEvent.type(document.querySelector('input[name="password"]')!, 'pw')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    expect(saveEntry).toHaveBeenCalledOnce()
  })

  it('generates a password through the generator dialog', async () => {
    vi.mocked(generatePassword).mockResolvedValue('Generated123!')
    renderWithStore(
      <>
        <Form type="login" />
        <Generator />
      </>
    )
    await userEvent.click(screen.getByText('generate'))
    expect(await screen.findByTestId('generator-dialog')).toBeInTheDocument()
    await screen.findByText('Generated123!')

    await userEvent.click(screen.getByTestId('generator-use-button'))
    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[name="password"]')!.value).toBe('Generated123!')
    )
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
  })

  it('keeps in-progress edits when the entry refreshes mid-edit', async () => {
    // The revealed title differs from the metadata title so this wait proves
    // the decrypted values were actually adopted, not just the initial meta.
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ title: 'Google (decrypted)' }))
    const { rerender } = renderWithStore(<Form type="login" entry={loginMeta()} />)
    const title = document.querySelector<HTMLInputElement>('input[name="title"]')!
    await waitFor(() => expect(title.value).toBe('Google (decrypted)'))

    await userEvent.clear(title)
    await userEvent.type(title, 'Renamed by me')

    // A sync merge landing mid-edit bumps updatedAt and re-runs the decrypt.
    // The form adopts the reveal once, at open — a refetch must not clobber
    // what the user has typed (their save wins by last-writer-wins anyway).
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ title: 'Merged elsewhere' }))
    rerender(<Form type="login" entry={loginMeta({ updatedAt: '2024-06-01T00:00:00.000Z' })} />)
    await waitFor(() => expect(revealEntry).toHaveBeenCalledTimes(2))

    expect(title.value).toBe('Renamed by me')
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
    await userEvent.click(await screen.findByText('copyme'))
    await userEvent.click(document.querySelector('.item svg')!)
    expect(copyToClipboard).toHaveBeenCalled()
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

  it('names the kind once and reduces the stamps to one footer line', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry())
    renderWithStore(<Show entry={loginMeta()} />)

    // The eyebrow above the title is the only place the kind is named; the
    // "Type" ledger cell that repeated it is gone.
    expect(screen.getAllByText(t(kindOf('login').label))).toHaveLength(1)
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
    expect(screen.getByTestId('entry-stamps')).toHaveTextContent(
      /^Modified .+ · Created .+$/
    )
  })

  it('filters the list by a tag pressed in the detail pane', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ tags: ['work'] }))
    const { store } = renderWithStore(<Show entry={loginMeta({ tags: ['work'] })} />)

    await userEvent.click(await screen.findByLabelText('Filter by tag work'))
    expect(store.getState().filters.query).toBe('work')
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
