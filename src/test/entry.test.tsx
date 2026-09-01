import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Form from '@/components/Main/Body/Aside/Form'
import Show from '@/components/Main/Body/Aside/Show'
import Generator from '@/components/Main/Generator'
import { saveEntry, revealEntry, generatePassword, generateOtp, copyToClipboard, toEntryMeta } from '@/lib/commands'
import type { LoginEntry } from '@/lib/commands'
import { renderWithStore, loginEntry, loginMeta } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveEntry).mockImplementation(entry => Promise.resolve(toEntryMeta(entry)))
})

describe('Form', () => {
  it('renders login fields for a new entry', () => {
    renderWithStore(<Form />)
    // en-US maps "Website" -> "URL"
    expect(screen.getByText('URL')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('saves a valid new login', async () => {
    const { store } = renderWithStore(<Form />)
    await userEvent.type(document.querySelector('input[name="title"]')!, 'GitHub')
    await userEvent.type(document.querySelector('input[name="username"]')!, 'octocat')
    await userEvent.type(document.querySelector('input[name="password"]')!, 'pw')
    await userEvent.click(screen.getByText('Save'))

    expect(saveEntry).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().entries.items[0].title).toBe('GitHub'))
  })

  it('blocks saving an invalid entry', async () => {
    renderWithStore(<Form />)
    await userEvent.click(screen.getByText('Save'))
    expect(saveEntry).not.toHaveBeenCalled()
  })

  it('generates a password through the generator dialog', async () => {
    vi.mocked(generatePassword).mockResolvedValue('Generated123!')
    renderWithStore(
      <>
        <Form />
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
})
