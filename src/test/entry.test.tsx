import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Form from '@/components/Main/Body/Aside/Form'
import Show from '@/components/Main/Body/Aside/Show'
import { saveVault, generatePassword, generateOtp, copyToClipboard } from '@/lib/commands'
import type { LoginEntry } from '@/lib/commands'
import { renderWithStore, loginEntry } from './utils'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveVault).mockImplementation(entries => Promise.resolve({ entries }))
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

    expect(saveVault).toHaveBeenCalledOnce()
    await waitFor(() => expect(store.getState().entries.items[0].title).toBe('GitHub'))
  })

  it('blocks saving an invalid entry', async () => {
    renderWithStore(<Form />)
    await userEvent.click(screen.getByText('Save'))
    expect(saveVault).not.toHaveBeenCalled()
  })

  it('generates a password', async () => {
    vi.mocked(generatePassword).mockResolvedValue('Generated123!')
    renderWithStore(<Form />)
    await userEvent.click(screen.getByText('generate'))
    await waitFor(() =>
      expect(document.querySelector<HTMLInputElement>('input[name="password"]')!.value).toBe('Generated123!')
    )
  })
})

describe('Show', () => {
  it('renders entry details', () => {
    renderWithStore(<Show entry={loginEntry({ title: 'Google' })} />)
    expect(screen.getByRole('heading', { name: 'Google' })).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
  })

  it('renders and copies a TOTP code', async () => {
    vi.mocked(generateOtp).mockResolvedValue({ code: '123456', time: 25 })
    const entry = loginEntry({ otp: 'BASE32SECRET' }) as LoginEntry
    renderWithStore(<Show entry={entry} />)

    expect(await screen.findByText('123 456')).toBeInTheDocument()
    expect(generateOtp).toHaveBeenCalledWith('BASE32SECRET')
  })

  it('copies a field value', async () => {
    renderWithStore(<Show entry={loginEntry({ username: 'copyme' })} />)
    await userEvent.click(document.querySelector('.item svg')!)
    expect(copyToClipboard).toHaveBeenCalled()
  })
})
